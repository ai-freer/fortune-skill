#!/usr/bin/env node
/**
 * report-qa.mjs — 检查 Markdown 报告是否覆盖关键质量项。
 *
 * 用法:
 *   node scripts/report-qa.mjs --file reports/xxx.md
 */

import { readFileSync } from 'fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
  }
  return opts;
}

function fail(message) {
  process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + '\n');
  process.exit(1);
}

function matchedItems(content, items) {
  return items.filter(item => item.pattern.test(content));
}

function splitSentences(content) {
  return content
    .split(/(?<=[。！？!?；;])|\n+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function unhedgedEventSentences(content) {
  const eventVerbs = /(换工作|跳槽|离职|搬家|搬迁|换城市|结婚|分手|离婚|生病|破财|创业|升职|签约|买房|卖房|投资|移民|出国)/;
  const timeMention = /(\d{4}\s*年|\d{1,2}\s*月|正月|腊月|今年|明年|后年)/;
  const hedge = /(可能|倾向|信号|窗口|建议|或许|大概率|偏向|需要结合|不等于|不宜直接|未必|观察|主题|底色|风险)/;
  return splitSentences(content).filter(sentence =>
    timeMention.test(sentence) &&
    eventVerbs.test(sentence) &&
    /(将会|会|必|一定|必然|注定|应当|应该|需要)/.test(sentence) &&
    !hedge.test(sentence)
  );
}

function riskyMonthlyActions(content) {
  return splitSentences(content).filter(sentence =>
    /(\d{1,2}月|正月|腊月)/.test(sentence) &&
    /(应|应当|应该|需要|建议)/.test(sentence) &&
    /(换|签|买|卖|分手|结婚|搬|跳槽|离职|创业|投资)/.test(sentence) &&
    !/(主题|底色|观察|谨慎评估|不等于)/.test(sentence)
  );
}

function detectAudience(content) {
  const templateMatch = content.match(/报告模板[:：]\s*([a-z_]+)/);
  const templateId = templateMatch?.[1] || '';
  if (/student_report/.test(templateId) || /学生与学业报告|学生报告|青少年|升学|考试/.test(content.slice(0, 1200))) {
    return 'student';
  }
  if (/child|儿童/.test(templateId) || /儿童报告|小学阶段/.test(content.slice(0, 1200))) {
    return 'child';
  }
  return 'general';
}

function detectReportType(content) {
  const head = content.slice(0, 1800);
  const templateMatch = head.match(/报告模板[:：]\s*([a-z_]+)/);
  const templateId = templateMatch?.[1] || '';
  if (/main_life_report|long_year_month_report|monthly_outlook_report/.test(templateId)) return 'long';
  if (/summary|quick|brief/.test(templateId)) return 'short';
  if (/专项报告|本报告聚焦|只回答|单项/.test(head)) return 'topic';
  if (/详细命理分析报告|十年流年|逐月|月度报告|年度报告|主题报告/.test(head)) return 'long';
  return 'unknown';
}

function audienceBoundaryViolations(content) {
  const audience = detectAudience(content);
  if (!['student', 'child'].includes(audience)) return [];
  const forbidden = /(婚恋|跳槽|换工作|创业|投资|分手|结婚|离婚|买房|卖房)/;
  const guard = /(不写|禁止|不得|不要|避免|不输出|不涉及|不展开|不作为|不构成|不能写成|不宜写成)/;
  return splitSentences(content).filter(sentence =>
    forbidden.test(sentence) &&
    !guard.test(sentence)
  );
}

function dimensionShareWarnings(content, dimensionItems) {
  const plain = content.replace(/```[\s\S]*?```/g, ' ');
  const total = Math.max(plain.length, 1);
  const counts = dimensionItems.map(item => {
    const matches = plain.match(new RegExp(item.pattern.source, 'g')) || [];
    return { ...item, count: matches.length, approxChars: matches.length * 20 };
  });
  const careerWealth = counts
    .filter(item => ['career', 'wealth'].includes(item.id))
    .reduce((sum, item) => sum + item.approxChars, 0);
  const dominant = counts.find(item => item.approxChars / total > 0.4);
  const warnings = [];
  if (dominant) warnings.push(`${dominant.label}疑似占比过高`);
  if (careerWealth / total > 0.6) warnings.push('事业+财务疑似占比过高');
  return warnings;
}

function check(content) {
  const mentionsNoble = /贵人/.test(content);
  const reportType = detectReportType(content);
  const isLongReport = reportType === 'long';
  const hasHecanV2 = /结构化合参\s*v2|fortune\.hecanSummary\.v2|v2\s*判断卡片/.test(content);
  const methodologyItems = [
    { id: 'classical_rule_index', label: '经典规则索引', pattern: /经典规则|穷通|调候|格局|病药|滴天髓|子平/ },
    { id: 'yongshen_system', label: '用神体系', pattern: /用神体系|扶抑|调候用神|通关|病药用神|喜用神/ },
    { id: 'interaction_priority', label: '作用优先级', pattern: /作用优先级|月令优先|大运为环境|流年为触发|合化|成局/ },
    { id: 'ziwei_deepening', label: '紫微深化', pattern: /紫微深化|四化落宫|三方四正|大限|流年四化|宫位/ },
    { id: 'historical_calibration', label: '历史经验校准', pattern: /历史经验校准|现实校准|事件校准|未校准|个人响应模式/ },
    { id: 'life_stage_templates', label: '人生阶段模板', pattern: /人生阶段|儿童|学生|青年|中年|后半程|专项报告/ }
  ];
  const dimensionItems = [
    { id: 'career', label: '事业', pattern: /事业|职业|工作|官禄|平台/ },
    { id: 'wealth', label: '财务', pattern: /财务|财运|财帛|现金流|预算|资产/ },
    { id: 'relationship', label: '关系', pattern: /感情|关系|伴侣|夫妻|合作/ },
    { id: 'health', label: '健康', pattern: /健康|身心|睡眠|疾厄|消耗/ },
    { id: 'migration', label: '迁移', pattern: /迁移|城市|出差|外部平台|跨城/ },
    { id: 'study', label: '学业', pattern: /学业|考试|文书|证书|学习/ },
    { id: 'family', label: '家庭', pattern: /家庭|田宅|亲子|长辈|居住/ },
    { id: 'children', label: '子女/后辈', pattern: /子女|后辈|下属|学生|传承/ },
    { id: 'parents', label: '父母/长辈', pattern: /父母|长辈|上级|师长|照护/ },
    { id: 'siblings', label: '同辈/团队', pattern: /兄弟|姐妹|同辈|团队|伙伴/ },
    { id: 'friends', label: '朋友/人脉', pattern: /朋友|人脉|社交|弱连接|引荐/ },
    { id: 'psychology', label: '心理状态', pattern: /心理|情绪|压力|安全感|自我要求/ },
    { id: 'interests', label: '兴趣/表达', pattern: /兴趣|表达|创作|作品|内容|爱好/ }
  ];
  const methodologyMatches = matchedItems(content, methodologyItems);
  const dimensionMatches = matchedItems(content, dimensionItems);
  const topicScoped = /专项报告|只回答|单年|单项|本报告聚焦/.test(content);
  const audienceViolations = audienceBoundaryViolations(content);
  const checks = [
    {
      id: 'disclaimer',
      label: '免责声明',
      pass: /免责声明|仅供.*参考|不构成/.test(content),
      severity: 'error'
    },
    {
      id: 'birth_time_boundary',
      label: '时辰边界/时间校正',
      pass: /时辰边界|地方平太阳时|真太阳时|时间校正|时辰校正/.test(content),
      severity: 'warn'
    },
    {
      id: 'methodology',
      label: '方法论核对',
      pass: /方法论|经典规则|用神体系|作用优先级/.test(content),
      severity: 'warn'
    },
    {
      id: 'methodology_matrix',
      label: '六大方法论覆盖矩阵',
      pass: methodologyMatches.length === methodologyItems.length,
      severity: isLongReport ? 'error' : 'warn',
      detail: `已覆盖 ${methodologyMatches.length}/${methodologyItems.length}：${methodologyMatches.map(item => item.label).join('、') || '无'}`
    },
    {
      id: 'dimension_balance',
      label: '现实维度均衡',
      pass: topicScoped || dimensionMatches.length >= (isLongReport ? 8 : 5),
      severity: isLongReport ? 'error' : 'warn',
      detail: `已覆盖 ${dimensionMatches.length}/${dimensionItems.length}：${dimensionMatches.map(item => item.label).join('、') || '无'}`
    },
    {
      id: 'rule_evidence_chain',
      label: '规则证据链',
      pass: !/规则命中|经典规则/.test(content) || (
        /证据|依据|月支|日主|五行|大运|流年|四化|宫位|神煞|字段/.test(content) &&
        /现实承接|边界|不单独断|保守|校准/.test(content)
      ),
      severity: 'warn'
    },
    {
      id: 'hecan_v2_cards',
      label: '结构化合参 v2 卡片',
      pass: topicScoped || !isLongReport || hasHecanV2,
      severity: isLongReport ? 'error' : 'warn',
      detail: '长报告应包含结构化合参 v2 判断卡片，避免只靠正文自由发挥。'
    },
    {
      id: 'hecan_v2_traceability',
      label: 'v2 证据追溯',
      pass: !hasHecanV2 || (
        /证据节点|evidenceNodes|证据来源|fieldPath/.test(content) &&
        /反证\/约束|反证|约束|counterEvidence/.test(content) &&
        /置信度构成|confidenceBreakdown/.test(content)
      ),
      severity: 'error',
      detail: 'v2 卡片必须能看到证据节点、反证/约束和置信度构成。'
    },
    {
      id: 'hecan_v2_boundary',
      label: 'v2 判断边界',
      pass: !hasHecanV2 || /不代表事件必然发生|不写成确定事件|只描述证据一致性|可判定性/.test(content),
      severity: 'error',
      detail: 'v2 卡片必须说明置信度只代表证据一致性/可判定性，不代表事件必然发生。'
    },
    {
      id: 'hecan_v2_coverage_policy',
      label: 'v2 覆盖策略',
      pass: !hasHecanV2 || /覆盖策略|覆盖状态|requiredSources|必要来源|缺口/.test(content),
      severity: 'error',
      detail: 'v2 卡片必须呈现领域覆盖状态、必要来源或缺口。'
    },
    {
      id: 'hecan_v2_body_binding',
      label: 'v2 正文绑定',
      pass: !hasHecanV2 || /正文绑定要求|本领域正文必须引用|证据来源.*现实承接|风险边界/.test(content),
      severity: 'error',
      detail: 'v2 卡片不能只贴表，必须要求正文引用证据来源、现实承接和风险边界。'
    },
    {
      id: 'hecan_v2_sensitive_boundaries',
      label: 'v2 敏感领域专业边界',
      pass: !hasHecanV2 || (
        !/健康\/消耗|健康/.test(content) || /医学|医生|诊断/.test(content)
      ) && (
        !/财务\/兑现|财务/.test(content) || /现金流|预算|投资建议|财务专业/.test(content)
      ),
      severity: 'error',
      detail: '健康和财务领域必须出现医学/医生/诊断、现金流/预算/投资建议等专业边界。'
    },
    {
      id: 'reality_calibration',
      label: '现实校准状态',
      pass: /现实校准|历史校准|未校准|校准表/.test(content),
      severity: 'warn'
    },
    {
      id: 'privacy_boundary',
      label: '隐私或敏感输出边界',
      pass: /隐私|个人经历|用户提供|不写入|reports\//.test(content),
      severity: 'info'
    },
    {
      id: 'noble_boundary',
      label: '贵人边界',
      pass: !mentionsNoble || /可承接资源|弱连接资源|高不确定资源|预算|授权|组织承接|低成本维护|小项目验证/.test(content),
      severity: 'warn'
    },
    {
      id: 'no_absolute_prediction',
      label: '避免绝对化预测',
      pass: !/(一定会|必然会|百分之百|注定会)/.test(content) && unhedgedEventSentences(content).length === 0,
      detail: unhedgedEventSentences(content).slice(0, 3).join(' / '),
      severity: 'error'
    },
    {
      id: 'actionability',
      label: '现实建议',
      pass: /建议|策略|风险|承接|边界/.test(content),
      severity: 'warn'
    },
    {
      id: 'score_not_fortune',
      label: '评分不等于吉凶',
      pass: !/(高分|较强|5\/5).{0,12}(就是|等于|代表).{0,8}(好运|大吉|一定顺利)/.test(content),
      severity: 'warn'
    },
    {
      id: 'migration_not_absolute',
      label: '迁移不绝对化',
      pass: !/(一定|必然|注定).{0,8}(离开|换城市|搬迁|出国|移民)/.test(content),
      severity: 'error'
    },
    {
      id: 'noble_not_identity_only',
      label: '贵人不只看身份',
      pass: !mentionsNoble || !/(正国级|高位|大人物).{0,20}(一定|必然|就是).{0,8}(可承接资源|贵人|资源)/.test(content),
      severity: 'error'
    },
    {
      id: 'specific_event_not_overfit',
      label: '避免具体事件过拟合',
      pass: !/\d{4}年.{0,16}(必|一定|必然|注定).{0,16}(离职|结婚|生病|破财|搬家|升职|创业)/.test(content),
      severity: 'error'
    },
    {
      id: 'signal_not_event',
      label: '信号强度不等于事件',
      pass: !/(信号高|信号强|强信号|中高|高).{0,8}(将|会|即将|应当|应该|需要).{0,12}(换工作|搬家|结婚|生病|破财|创业|跳槽|离职)/.test(content),
      severity: 'error'
    },
    {
      id: 'monthly_action_not_overfit',
      label: '逐月不输出具体行动指令',
      pass: riskyMonthlyActions(content).length === 0,
      detail: riskyMonthlyActions(content).slice(0, 3).join(' / '),
      severity: 'error'
    },
    {
      id: 'audience_boundary',
      label: '学生/儿童受众边界',
      pass: audienceViolations.length === 0,
      detail: audienceViolations.slice(0, 3).join(' / '),
      severity: 'error'
    },
    {
      id: 'no_default_noble_section',
      label: '非专项不默认贵人标题',
      pass: !/^##\s*.*贵人/m.test(content) || /贵人专项|人脉专项|平台资源专项/.test(content),
      severity: 'warn'
    },
    {
      id: 'deceased_health_boundary',
      label: '已故对象健康评分边界',
      pass: !(/已故|已逝|去世/.test(content) && /健康消耗\s*\d\/5/.test(content)),
      severity: 'error'
    },
    {
      id: 'dimension_weight_balance',
      label: '维度字数权重均衡',
      pass: topicScoped || dimensionShareWarnings(content, dimensionItems).length === 0,
      detail: dimensionShareWarnings(content, dimensionItems).join('；'),
      severity: isLongReport ? 'error' : 'warn'
    }
  ];

  const findings = checks
    .filter(item => !item.pass)
    .map(item => ({
      id: item.id,
      label: item.label,
      severity: item.severity,
      message: item.detail || `报告缺少或未明显覆盖：${item.label}`
    }));

  return {
    ok: findings.every(item => item.severity !== 'error'),
    summary: {
      checkCount: checks.length,
      passed: checks.length - findings.length,
      findings: findings.length,
      reportType
    },
    findings
  };
}

function main() {
  const opts = parseArgs();
  if (!opts.file) fail('缺少 --file 参数');
  let content;
  try {
    content = readFileSync(opts.file, 'utf8');
  } catch (error) {
    fail(`无法读取报告文件: ${error.message}`);
  }
  const result = check(content);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.ok) process.exit(1);
}

main();
