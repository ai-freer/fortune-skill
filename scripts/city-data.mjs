/**
 * city-data.mjs — 城市经度数据库 + 时区标准经度映射
 *
 * 中国：覆盖全部 330+ 地级市（含直辖市、省会、地级市、自治州/盟）
 * 海外：80+ 主要城市（中英文双条目）
 *
 * 格式: { name, timezone, longitude, province? }
 * - 中国城市统一 Asia/Shanghai（北京时间），经度差异通过地方平太阳时校正
 * - 海外城市使用各自 IANA 时区
 */

// ─── 城市经度表 ─────────────────────────────────────────────
export const CITY_DB = [

  // ════════════════════════════════════════════════════════════
  // 中国城市
  // ════════════════════════════════════════════════════════════

  // ── 直辖市 ──
  { name: '北京', timezone: 'Asia/Shanghai', longitude: 116.40, province: '北京' },
  { name: '上海', timezone: 'Asia/Shanghai', longitude: 121.47, province: '上海' },
  { name: '天津', timezone: 'Asia/Shanghai', longitude: 117.20, province: '天津' },
  { name: '重庆', timezone: 'Asia/Shanghai', longitude: 106.55, province: '重庆' },

  // ── 省会城市 / 自治区首府 ──
  { name: '石家庄', timezone: 'Asia/Shanghai', longitude: 114.51, province: '河北' },
  { name: '太原', timezone: 'Asia/Shanghai', longitude: 112.55, province: '山西' },
  { name: '呼和浩特', timezone: 'Asia/Shanghai', longitude: 111.75, province: '内蒙古' },
  { name: '沈阳', timezone: 'Asia/Shanghai', longitude: 123.43, province: '辽宁' },
  { name: '长春', timezone: 'Asia/Shanghai', longitude: 125.32, province: '吉林' },
  { name: '哈尔滨', timezone: 'Asia/Shanghai', longitude: 126.63, province: '黑龙江' },
  { name: '南京', timezone: 'Asia/Shanghai', longitude: 118.78, province: '江苏' },
  { name: '杭州', timezone: 'Asia/Shanghai', longitude: 120.15, province: '浙江' },
  { name: '合肥', timezone: 'Asia/Shanghai', longitude: 117.28, province: '安徽' },
  { name: '福州', timezone: 'Asia/Shanghai', longitude: 119.30, province: '福建' },
  { name: '南昌', timezone: 'Asia/Shanghai', longitude: 115.86, province: '江西' },
  { name: '济南', timezone: 'Asia/Shanghai', longitude: 117.00, province: '山东' },
  { name: '郑州', timezone: 'Asia/Shanghai', longitude: 113.65, province: '河南' },
  { name: '武汉', timezone: 'Asia/Shanghai', longitude: 114.30, province: '湖北' },
  { name: '长沙', timezone: 'Asia/Shanghai', longitude: 112.97, province: '湖南' },
  { name: '广州', timezone: 'Asia/Shanghai', longitude: 113.26, province: '广东' },
  { name: '南宁', timezone: 'Asia/Shanghai', longitude: 108.37, province: '广西' },
  { name: '海口', timezone: 'Asia/Shanghai', longitude: 110.35, province: '海南' },
  { name: '成都', timezone: 'Asia/Shanghai', longitude: 104.07, province: '四川' },
  { name: '贵阳', timezone: 'Asia/Shanghai', longitude: 106.71, province: '贵州' },
  { name: '昆明', timezone: 'Asia/Shanghai', longitude: 102.68, province: '云南' },
  { name: '拉萨', timezone: 'Asia/Shanghai', longitude: 91.13, province: '西藏' },
  { name: '西安', timezone: 'Asia/Shanghai', longitude: 108.94, province: '陕西' },
  { name: '兰州', timezone: 'Asia/Shanghai', longitude: 103.83, province: '甘肃' },
  { name: '西宁', timezone: 'Asia/Shanghai', longitude: 101.78, province: '青海' },
  { name: '银川', timezone: 'Asia/Shanghai', longitude: 106.23, province: '宁夏' },
  { name: '乌鲁木齐', timezone: 'Asia/Shanghai', longitude: 87.62, province: '新疆' },

  // ── 特别行政区 / 台湾 ──
  { name: '台北', timezone: 'Asia/Taipei', longitude: 121.56, province: '台湾' },
  { name: '香港', timezone: 'Asia/Hong_Kong', longitude: 114.17, province: '香港' },
  { name: '澳门', timezone: 'Asia/Macau', longitude: 113.55, province: '澳门' },

  // ── 河北省 ──
  { name: '唐山', timezone: 'Asia/Shanghai', longitude: 118.18, province: '河北' },
  { name: '秦皇岛', timezone: 'Asia/Shanghai', longitude: 119.60, province: '河北' },
  { name: '邯郸', timezone: 'Asia/Shanghai', longitude: 114.48, province: '河北' },
  { name: '邢台', timezone: 'Asia/Shanghai', longitude: 114.50, province: '河北' },
  { name: '保定', timezone: 'Asia/Shanghai', longitude: 115.46, province: '河北' },
  { name: '张家口', timezone: 'Asia/Shanghai', longitude: 114.88, province: '河北' },
  { name: '承德', timezone: 'Asia/Shanghai', longitude: 117.93, province: '河北' },
  { name: '沧州', timezone: 'Asia/Shanghai', longitude: 116.86, province: '河北' },
  { name: '廊坊', timezone: 'Asia/Shanghai', longitude: 116.70, province: '河北' },
  { name: '衡水', timezone: 'Asia/Shanghai', longitude: 115.67, province: '河北' },

  // ── 山西省 ──
  { name: '大同', timezone: 'Asia/Shanghai', longitude: 113.30, province: '山西' },
  { name: '阳泉', timezone: 'Asia/Shanghai', longitude: 113.58, province: '山西' },
  { name: '长治', timezone: 'Asia/Shanghai', longitude: 113.12, province: '山西' },
  { name: '晋城', timezone: 'Asia/Shanghai', longitude: 112.85, province: '山西' },
  { name: '朔州', timezone: 'Asia/Shanghai', longitude: 112.43, province: '山西' },
  { name: '晋中', timezone: 'Asia/Shanghai', longitude: 112.75, province: '山西' },
  { name: '运城', timezone: 'Asia/Shanghai', longitude: 111.01, province: '山西' },
  { name: '忻州', timezone: 'Asia/Shanghai', longitude: 112.73, province: '山西' },
  { name: '临汾', timezone: 'Asia/Shanghai', longitude: 111.52, province: '山西' },
  { name: '吕梁', timezone: 'Asia/Shanghai', longitude: 111.14, province: '山西' },

  // ── 内蒙古自治区 ──
  { name: '包头', timezone: 'Asia/Shanghai', longitude: 109.84, province: '内蒙古' },
  { name: '乌海', timezone: 'Asia/Shanghai', longitude: 106.81, province: '内蒙古' },
  { name: '赤峰', timezone: 'Asia/Shanghai', longitude: 118.89, province: '内蒙古' },
  { name: '通辽', timezone: 'Asia/Shanghai', longitude: 122.26, province: '内蒙古' },
  { name: '鄂尔多斯', timezone: 'Asia/Shanghai', longitude: 109.99, province: '内蒙古' },
  { name: '呼伦贝尔', timezone: 'Asia/Shanghai', longitude: 119.77, province: '内蒙古' },
  { name: '巴彦淖尔', timezone: 'Asia/Shanghai', longitude: 107.39, province: '内蒙古' },
  { name: '乌兰察布', timezone: 'Asia/Shanghai', longitude: 113.13, province: '内蒙古' },
  { name: '兴安盟', timezone: 'Asia/Shanghai', longitude: 122.04, province: '内蒙古' },
  { name: '锡林郭勒盟', timezone: 'Asia/Shanghai', longitude: 116.05, province: '内蒙古' },
  { name: '阿拉善盟', timezone: 'Asia/Shanghai', longitude: 105.73, province: '内蒙古' },

  // ── 辽宁省 ──
  { name: '大连', timezone: 'Asia/Shanghai', longitude: 121.62, province: '辽宁' },
  { name: '鞍山', timezone: 'Asia/Shanghai', longitude: 122.99, province: '辽宁' },
  { name: '抚顺', timezone: 'Asia/Shanghai', longitude: 123.96, province: '辽宁' },
  { name: '本溪', timezone: 'Asia/Shanghai', longitude: 123.77, province: '辽宁' },
  { name: '丹东', timezone: 'Asia/Shanghai', longitude: 124.38, province: '辽宁' },
  { name: '锦州', timezone: 'Asia/Shanghai', longitude: 121.13, province: '辽宁' },
  { name: '营口', timezone: 'Asia/Shanghai', longitude: 122.24, province: '辽宁' },
  { name: '阜新', timezone: 'Asia/Shanghai', longitude: 121.67, province: '辽宁' },
  { name: '辽阳', timezone: 'Asia/Shanghai', longitude: 123.17, province: '辽宁' },
  { name: '盘锦', timezone: 'Asia/Shanghai', longitude: 122.07, province: '辽宁' },
  { name: '铁岭', timezone: 'Asia/Shanghai', longitude: 123.84, province: '辽宁' },
  { name: '朝阳', timezone: 'Asia/Shanghai', longitude: 120.45, province: '辽宁' },
  { name: '葫芦岛', timezone: 'Asia/Shanghai', longitude: 120.84, province: '辽宁' },

  // ── 吉林省 ──
  { name: '吉林', timezone: 'Asia/Shanghai', longitude: 126.55, province: '吉林' },
  { name: '四平', timezone: 'Asia/Shanghai', longitude: 124.37, province: '吉林' },
  { name: '辽源', timezone: 'Asia/Shanghai', longitude: 125.15, province: '吉林' },
  { name: '通化', timezone: 'Asia/Shanghai', longitude: 125.94, province: '吉林' },
  { name: '白山', timezone: 'Asia/Shanghai', longitude: 126.42, province: '吉林' },
  { name: '松原', timezone: 'Asia/Shanghai', longitude: 124.82, province: '吉林' },
  { name: '白城', timezone: 'Asia/Shanghai', longitude: 122.84, province: '吉林' },
  { name: '延边', timezone: 'Asia/Shanghai', longitude: 129.51, province: '吉林' },

  // ── 黑龙江省 ──
  { name: '齐齐哈尔', timezone: 'Asia/Shanghai', longitude: 123.97, province: '黑龙江' },
  { name: '鸡西', timezone: 'Asia/Shanghai', longitude: 130.97, province: '黑龙江' },
  { name: '鹤岗', timezone: 'Asia/Shanghai', longitude: 130.28, province: '黑龙江' },
  { name: '双鸭山', timezone: 'Asia/Shanghai', longitude: 131.16, province: '黑龙江' },
  { name: '大庆', timezone: 'Asia/Shanghai', longitude: 125.10, province: '黑龙江' },
  { name: '伊春', timezone: 'Asia/Shanghai', longitude: 128.90, province: '黑龙江' },
  { name: '佳木斯', timezone: 'Asia/Shanghai', longitude: 130.32, province: '黑龙江' },
  { name: '七台河', timezone: 'Asia/Shanghai', longitude: 131.00, province: '黑龙江' },
  { name: '牡丹江', timezone: 'Asia/Shanghai', longitude: 129.63, province: '黑龙江' },
  { name: '黑河', timezone: 'Asia/Shanghai', longitude: 127.53, province: '黑龙江' },
  { name: '绥化', timezone: 'Asia/Shanghai', longitude: 126.97, province: '黑龙江' },
  { name: '大兴安岭', timezone: 'Asia/Shanghai', longitude: 124.12, province: '黑龙江' },

  // ── 江苏省 ──
  { name: '苏州', timezone: 'Asia/Shanghai', longitude: 120.62, province: '江苏' },
  { name: '无锡', timezone: 'Asia/Shanghai', longitude: 120.30, province: '江苏' },
  { name: '常州', timezone: 'Asia/Shanghai', longitude: 119.97, province: '江苏' },
  { name: '徐州', timezone: 'Asia/Shanghai', longitude: 117.28, province: '江苏' },
  { name: '南通', timezone: 'Asia/Shanghai', longitude: 120.86, province: '江苏' },
  { name: '连云港', timezone: 'Asia/Shanghai', longitude: 119.22, province: '江苏' },
  { name: '淮安', timezone: 'Asia/Shanghai', longitude: 119.02, province: '江苏' },
  { name: '盐城', timezone: 'Asia/Shanghai', longitude: 120.16, province: '江苏' },
  { name: '扬州', timezone: 'Asia/Shanghai', longitude: 119.41, province: '江苏' },
  { name: '镇江', timezone: 'Asia/Shanghai', longitude: 119.45, province: '江苏' },
  { name: '泰州', timezone: 'Asia/Shanghai', longitude: 119.92, province: '江苏' },
  { name: '宿迁', timezone: 'Asia/Shanghai', longitude: 118.28, province: '江苏' },

  // ── 浙江省 ──
  { name: '宁波', timezone: 'Asia/Shanghai', longitude: 121.55, province: '浙江' },
  { name: '温州', timezone: 'Asia/Shanghai', longitude: 120.67, province: '浙江' },
  { name: '嘉兴', timezone: 'Asia/Shanghai', longitude: 120.76, province: '浙江' },
  { name: '湖州', timezone: 'Asia/Shanghai', longitude: 120.09, province: '浙江' },
  { name: '绍兴', timezone: 'Asia/Shanghai', longitude: 120.58, province: '浙江' },
  { name: '金华', timezone: 'Asia/Shanghai', longitude: 119.65, province: '浙江' },
  { name: '衢州', timezone: 'Asia/Shanghai', longitude: 118.87, province: '浙江' },
  { name: '舟山', timezone: 'Asia/Shanghai', longitude: 122.11, province: '浙江' },
  { name: '台州', timezone: 'Asia/Shanghai', longitude: 121.42, province: '浙江' },
  { name: '丽水', timezone: 'Asia/Shanghai', longitude: 119.92, province: '浙江' },

  // ── 安徽省 ──
  { name: '芜湖', timezone: 'Asia/Shanghai', longitude: 118.38, province: '安徽' },
  { name: '蚌埠', timezone: 'Asia/Shanghai', longitude: 117.39, province: '安徽' },
  { name: '淮南', timezone: 'Asia/Shanghai', longitude: 117.02, province: '安徽' },
  { name: '马鞍山', timezone: 'Asia/Shanghai', longitude: 118.51, province: '安徽' },
  { name: '淮北', timezone: 'Asia/Shanghai', longitude: 116.79, province: '安徽' },
  { name: '铜陵', timezone: 'Asia/Shanghai', longitude: 117.81, province: '安徽' },
  { name: '安庆', timezone: 'Asia/Shanghai', longitude: 117.05, province: '安徽' },
  { name: '黄山', timezone: 'Asia/Shanghai', longitude: 118.34, province: '安徽' },
  { name: '滁州', timezone: 'Asia/Shanghai', longitude: 118.32, province: '安徽' },
  { name: '阜阳', timezone: 'Asia/Shanghai', longitude: 115.81, province: '安徽' },
  { name: '宿州', timezone: 'Asia/Shanghai', longitude: 116.96, province: '安徽' },
  { name: '六安', timezone: 'Asia/Shanghai', longitude: 116.52, province: '安徽' },
  { name: '亳州', timezone: 'Asia/Shanghai', longitude: 115.78, province: '安徽' },
  { name: '池州', timezone: 'Asia/Shanghai', longitude: 117.49, province: '安徽' },
  { name: '宣城', timezone: 'Asia/Shanghai', longitude: 118.76, province: '安徽' },

  // ── 福建省 ──
  { name: '厦门', timezone: 'Asia/Shanghai', longitude: 118.09, province: '福建' },
  { name: '莆田', timezone: 'Asia/Shanghai', longitude: 119.01, province: '福建' },
  { name: '三明', timezone: 'Asia/Shanghai', longitude: 117.64, province: '福建' },
  { name: '泉州', timezone: 'Asia/Shanghai', longitude: 118.68, province: '福建' },
  { name: '漳州', timezone: 'Asia/Shanghai', longitude: 117.65, province: '福建' },
  { name: '南平', timezone: 'Asia/Shanghai', longitude: 118.18, province: '福建' },
  { name: '龙岩', timezone: 'Asia/Shanghai', longitude: 117.03, province: '福建' },
  { name: '宁德', timezone: 'Asia/Shanghai', longitude: 119.53, province: '福建' },

  // ── 江西省 ──
  { name: '景德镇', timezone: 'Asia/Shanghai', longitude: 117.18, province: '江西' },
  { name: '萍乡', timezone: 'Asia/Shanghai', longitude: 113.85, province: '江西' },
  { name: '九江', timezone: 'Asia/Shanghai', longitude: 115.99, province: '江西' },
  { name: '新余', timezone: 'Asia/Shanghai', longitude: 114.92, province: '江西' },
  { name: '鹰潭', timezone: 'Asia/Shanghai', longitude: 117.07, province: '江西' },
  { name: '赣州', timezone: 'Asia/Shanghai', longitude: 114.94, province: '江西' },
  { name: '吉安', timezone: 'Asia/Shanghai', longitude: 114.99, province: '江西' },
  { name: '宜春', timezone: 'Asia/Shanghai', longitude: 114.39, province: '江西' },
  { name: '抚州', timezone: 'Asia/Shanghai', longitude: 116.36, province: '江西' },
  { name: '上饶', timezone: 'Asia/Shanghai', longitude: 117.97, province: '江西' },

  // ── 山东省 ──
  { name: '青岛', timezone: 'Asia/Shanghai', longitude: 120.38, province: '山东' },
  { name: '淄博', timezone: 'Asia/Shanghai', longitude: 118.05, province: '山东' },
  { name: '枣庄', timezone: 'Asia/Shanghai', longitude: 117.32, province: '山东' },
  { name: '东营', timezone: 'Asia/Shanghai', longitude: 118.67, province: '山东' },
  { name: '烟台', timezone: 'Asia/Shanghai', longitude: 121.45, province: '山东' },
  { name: '潍坊', timezone: 'Asia/Shanghai', longitude: 119.16, province: '山东' },
  { name: '济宁', timezone: 'Asia/Shanghai', longitude: 116.59, province: '山东' },
  { name: '泰安', timezone: 'Asia/Shanghai', longitude: 117.09, province: '山东' },
  { name: '威海', timezone: 'Asia/Shanghai', longitude: 122.12, province: '山东' },
  { name: '日照', timezone: 'Asia/Shanghai', longitude: 119.53, province: '山东' },
  { name: '临沂', timezone: 'Asia/Shanghai', longitude: 118.36, province: '山东' },
  { name: '德州', timezone: 'Asia/Shanghai', longitude: 116.36, province: '山东' },
  { name: '聊城', timezone: 'Asia/Shanghai', longitude: 115.98, province: '山东' },
  { name: '滨州', timezone: 'Asia/Shanghai', longitude: 117.97, province: '山东' },
  { name: '菏泽', timezone: 'Asia/Shanghai', longitude: 115.48, province: '山东' },

  // ── 河南省 ──
  { name: '开封', timezone: 'Asia/Shanghai', longitude: 114.31, province: '河南' },
  { name: '洛阳', timezone: 'Asia/Shanghai', longitude: 112.45, province: '河南' },
  { name: '平顶山', timezone: 'Asia/Shanghai', longitude: 113.19, province: '河南' },
  { name: '安阳', timezone: 'Asia/Shanghai', longitude: 114.39, province: '河南' },
  { name: '鹤壁', timezone: 'Asia/Shanghai', longitude: 114.30, province: '河南' },
  { name: '新乡', timezone: 'Asia/Shanghai', longitude: 113.88, province: '河南' },
  { name: '焦作', timezone: 'Asia/Shanghai', longitude: 113.24, province: '河南' },
  { name: '濮阳', timezone: 'Asia/Shanghai', longitude: 115.03, province: '河南' },
  { name: '许昌', timezone: 'Asia/Shanghai', longitude: 113.85, province: '河南' },
  { name: '漯河', timezone: 'Asia/Shanghai', longitude: 114.02, province: '河南' },
  { name: '三门峡', timezone: 'Asia/Shanghai', longitude: 111.20, province: '河南' },
  { name: '南阳', timezone: 'Asia/Shanghai', longitude: 112.53, province: '河南' },
  { name: '商丘', timezone: 'Asia/Shanghai', longitude: 115.65, province: '河南' },
  { name: '信阳', timezone: 'Asia/Shanghai', longitude: 114.07, province: '河南' },
  { name: '周口', timezone: 'Asia/Shanghai', longitude: 114.70, province: '河南' },
  { name: '驻马店', timezone: 'Asia/Shanghai', longitude: 114.02, province: '河南' },
  { name: '济源', timezone: 'Asia/Shanghai', longitude: 112.60, province: '河南' },

  // ── 湖北省 ──
  { name: '黄石', timezone: 'Asia/Shanghai', longitude: 115.04, province: '湖北' },
  { name: '十堰', timezone: 'Asia/Shanghai', longitude: 110.80, province: '湖北' },
  { name: '宜昌', timezone: 'Asia/Shanghai', longitude: 111.29, province: '湖北' },
  { name: '襄阳', timezone: 'Asia/Shanghai', longitude: 112.14, province: '湖北' },
  { name: '鄂州', timezone: 'Asia/Shanghai', longitude: 114.89, province: '湖北' },
  { name: '荆门', timezone: 'Asia/Shanghai', longitude: 112.20, province: '湖北' },
  { name: '孝感', timezone: 'Asia/Shanghai', longitude: 113.92, province: '湖北' },
  { name: '荆州', timezone: 'Asia/Shanghai', longitude: 112.24, province: '湖北' },
  { name: '黄冈', timezone: 'Asia/Shanghai', longitude: 114.87, province: '湖北' },
  { name: '咸宁', timezone: 'Asia/Shanghai', longitude: 114.32, province: '湖北' },
  { name: '随州', timezone: 'Asia/Shanghai', longitude: 113.38, province: '湖北' },
  { name: '恩施', timezone: 'Asia/Shanghai', longitude: 109.49, province: '湖北' },
  { name: '仙桃', timezone: 'Asia/Shanghai', longitude: 113.44, province: '湖北' },
  { name: '潜江', timezone: 'Asia/Shanghai', longitude: 112.90, province: '湖北' },
  { name: '天门', timezone: 'Asia/Shanghai', longitude: 113.17, province: '湖北' },
  { name: '神农架', timezone: 'Asia/Shanghai', longitude: 110.68, province: '湖北' },

  // ── 湖南省 ──
  { name: '株洲', timezone: 'Asia/Shanghai', longitude: 113.13, province: '湖南' },
  { name: '湘潭', timezone: 'Asia/Shanghai', longitude: 112.94, province: '湖南' },
  { name: '衡阳', timezone: 'Asia/Shanghai', longitude: 112.57, province: '湖南' },
  { name: '邵阳', timezone: 'Asia/Shanghai', longitude: 111.47, province: '湖南' },
  { name: '岳阳', timezone: 'Asia/Shanghai', longitude: 113.13, province: '湖南' },
  { name: '常德', timezone: 'Asia/Shanghai', longitude: 111.69, province: '湖南' },
  { name: '张家界', timezone: 'Asia/Shanghai', longitude: 110.48, province: '湖南' },
  { name: '益阳', timezone: 'Asia/Shanghai', longitude: 112.36, province: '湖南' },
  { name: '郴州', timezone: 'Asia/Shanghai', longitude: 113.01, province: '湖南' },
  { name: '永州', timezone: 'Asia/Shanghai', longitude: 111.61, province: '湖南' },
  { name: '怀化', timezone: 'Asia/Shanghai', longitude: 110.00, province: '湖南' },
  { name: '娄底', timezone: 'Asia/Shanghai', longitude: 112.00, province: '湖南' },
  { name: '湘西', timezone: 'Asia/Shanghai', longitude: 109.74, province: '湖南' },

  // ── 广东省 ──
  { name: '深圳', timezone: 'Asia/Shanghai', longitude: 114.06, province: '广东' },
  { name: '珠海', timezone: 'Asia/Shanghai', longitude: 113.58, province: '广东' },
  { name: '汕头', timezone: 'Asia/Shanghai', longitude: 116.68, province: '广东' },
  { name: '韶关', timezone: 'Asia/Shanghai', longitude: 113.60, province: '广东' },
  { name: '佛山', timezone: 'Asia/Shanghai', longitude: 113.12, province: '广东' },
  { name: '江门', timezone: 'Asia/Shanghai', longitude: 113.08, province: '广东' },
  { name: '湛江', timezone: 'Asia/Shanghai', longitude: 110.36, province: '广东' },
  { name: '茂名', timezone: 'Asia/Shanghai', longitude: 110.93, province: '广东' },
  { name: '肇庆', timezone: 'Asia/Shanghai', longitude: 112.47, province: '广东' },
  { name: '惠州', timezone: 'Asia/Shanghai', longitude: 114.42, province: '广东' },
  { name: '梅州', timezone: 'Asia/Shanghai', longitude: 116.12, province: '广东' },
  { name: '汕尾', timezone: 'Asia/Shanghai', longitude: 115.37, province: '广东' },
  { name: '河源', timezone: 'Asia/Shanghai', longitude: 114.70, province: '广东' },
  { name: '阳江', timezone: 'Asia/Shanghai', longitude: 111.98, province: '广东' },
  { name: '清远', timezone: 'Asia/Shanghai', longitude: 113.06, province: '广东' },
  { name: '东莞', timezone: 'Asia/Shanghai', longitude: 113.75, province: '广东' },
  { name: '中山', timezone: 'Asia/Shanghai', longitude: 113.38, province: '广东' },
  { name: '潮州', timezone: 'Asia/Shanghai', longitude: 116.63, province: '广东' },
  { name: '揭阳', timezone: 'Asia/Shanghai', longitude: 116.37, province: '广东' },
  { name: '云浮', timezone: 'Asia/Shanghai', longitude: 112.04, province: '广东' },

  // ── 广西壮族自治区 ──
  { name: '柳州', timezone: 'Asia/Shanghai', longitude: 109.41, province: '广西' },
  { name: '桂林', timezone: 'Asia/Shanghai', longitude: 110.29, province: '广西' },
  { name: '梧州', timezone: 'Asia/Shanghai', longitude: 111.28, province: '广西' },
  { name: '北海', timezone: 'Asia/Shanghai', longitude: 109.12, province: '广西' },
  { name: '防城港', timezone: 'Asia/Shanghai', longitude: 108.35, province: '广西' },
  { name: '钦州', timezone: 'Asia/Shanghai', longitude: 108.62, province: '广西' },
  { name: '贵港', timezone: 'Asia/Shanghai', longitude: 109.60, province: '广西' },
  { name: '玉林', timezone: 'Asia/Shanghai', longitude: 110.15, province: '广西' },
  { name: '百色', timezone: 'Asia/Shanghai', longitude: 106.62, province: '广西' },
  { name: '贺州', timezone: 'Asia/Shanghai', longitude: 111.57, province: '广西' },
  { name: '河池', timezone: 'Asia/Shanghai', longitude: 108.06, province: '广西' },
  { name: '来宾', timezone: 'Asia/Shanghai', longitude: 109.22, province: '广西' },
  { name: '崇左', timezone: 'Asia/Shanghai', longitude: 107.36, province: '广西' },

  // ── 海南省 ──
  { name: '三亚', timezone: 'Asia/Shanghai', longitude: 109.51, province: '海南' },
  { name: '三沙', timezone: 'Asia/Shanghai', longitude: 112.33, province: '海南' },
  { name: '儋州', timezone: 'Asia/Shanghai', longitude: 109.58, province: '海南' },

  // ── 四川省 ──
  { name: '自贡', timezone: 'Asia/Shanghai', longitude: 104.77, province: '四川' },
  { name: '攀枝花', timezone: 'Asia/Shanghai', longitude: 101.72, province: '四川' },
  { name: '泸州', timezone: 'Asia/Shanghai', longitude: 105.44, province: '四川' },
  { name: '德阳', timezone: 'Asia/Shanghai', longitude: 104.40, province: '四川' },
  { name: '绵阳', timezone: 'Asia/Shanghai', longitude: 104.73, province: '四川' },
  { name: '广元', timezone: 'Asia/Shanghai', longitude: 105.84, province: '四川' },
  { name: '遂宁', timezone: 'Asia/Shanghai', longitude: 105.59, province: '四川' },
  { name: '内江', timezone: 'Asia/Shanghai', longitude: 105.06, province: '四川' },
  { name: '乐山', timezone: 'Asia/Shanghai', longitude: 103.77, province: '四川' },
  { name: '南充', timezone: 'Asia/Shanghai', longitude: 106.11, province: '四川' },
  { name: '眉山', timezone: 'Asia/Shanghai', longitude: 103.85, province: '四川' },
  { name: '宜宾', timezone: 'Asia/Shanghai', longitude: 104.64, province: '四川' },
  { name: '广安', timezone: 'Asia/Shanghai', longitude: 106.63, province: '四川' },
  { name: '达州', timezone: 'Asia/Shanghai', longitude: 107.50, province: '四川' },
  { name: '雅安', timezone: 'Asia/Shanghai', longitude: 103.00, province: '四川' },
  { name: '巴中', timezone: 'Asia/Shanghai', longitude: 106.75, province: '四川' },
  { name: '资阳', timezone: 'Asia/Shanghai', longitude: 104.63, province: '四川' },
  { name: '阿坝', timezone: 'Asia/Shanghai', longitude: 102.22, province: '四川' },
  { name: '甘孜', timezone: 'Asia/Shanghai', longitude: 101.96, province: '四川' },
  { name: '凉山', timezone: 'Asia/Shanghai', longitude: 102.27, province: '四川' },

  // ── 贵州省 ──
  { name: '遵义', timezone: 'Asia/Shanghai', longitude: 106.93, province: '贵州' },
  { name: '六盘水', timezone: 'Asia/Shanghai', longitude: 104.83, province: '贵州' },
  { name: '安顺', timezone: 'Asia/Shanghai', longitude: 105.95, province: '贵州' },
  { name: '毕节', timezone: 'Asia/Shanghai', longitude: 105.29, province: '贵州' },
  { name: '铜仁', timezone: 'Asia/Shanghai', longitude: 109.19, province: '贵州' },
  { name: '黔西南', timezone: 'Asia/Shanghai', longitude: 104.90, province: '贵州' },
  { name: '黔东南', timezone: 'Asia/Shanghai', longitude: 107.98, province: '贵州' },
  { name: '黔南', timezone: 'Asia/Shanghai', longitude: 107.52, province: '贵州' },

  // ── 云南省 ──
  { name: '曲靖', timezone: 'Asia/Shanghai', longitude: 103.80, province: '云南' },
  { name: '玉溪', timezone: 'Asia/Shanghai', longitude: 102.55, province: '云南' },
  { name: '保山', timezone: 'Asia/Shanghai', longitude: 99.17, province: '云南' },
  { name: '昭通', timezone: 'Asia/Shanghai', longitude: 103.72, province: '云南' },
  { name: '丽江', timezone: 'Asia/Shanghai', longitude: 100.23, province: '云南' },
  { name: '普洱', timezone: 'Asia/Shanghai', longitude: 100.97, province: '云南' },
  { name: '临沧', timezone: 'Asia/Shanghai', longitude: 100.09, province: '云南' },
  { name: '楚雄', timezone: 'Asia/Shanghai', longitude: 101.55, province: '云南' },
  { name: '红河', timezone: 'Asia/Shanghai', longitude: 103.38, province: '云南' },
  { name: '文山', timezone: 'Asia/Shanghai', longitude: 104.24, province: '云南' },
  { name: '西双版纳', timezone: 'Asia/Shanghai', longitude: 100.80, province: '云南' },
  { name: '大理', timezone: 'Asia/Shanghai', longitude: 100.23, province: '云南' },
  { name: '德宏', timezone: 'Asia/Shanghai', longitude: 98.58, province: '云南' },
  { name: '怒江', timezone: 'Asia/Shanghai', longitude: 98.85, province: '云南' },
  { name: '迪庆', timezone: 'Asia/Shanghai', longitude: 99.70, province: '云南' },

  // ── 西藏自治区 ──
  { name: '昌都', timezone: 'Asia/Shanghai', longitude: 97.17, province: '西藏' },
  { name: '山南', timezone: 'Asia/Shanghai', longitude: 91.77, province: '西藏' },
  { name: '日喀则', timezone: 'Asia/Shanghai', longitude: 88.88, province: '西藏' },
  { name: '那曲', timezone: 'Asia/Shanghai', longitude: 92.05, province: '西藏' },
  { name: '阿里', timezone: 'Asia/Shanghai', longitude: 80.11, province: '西藏' },
  { name: '林芝', timezone: 'Asia/Shanghai', longitude: 94.36, province: '西藏' },

  // ── 陕西省 ──
  { name: '铜川', timezone: 'Asia/Shanghai', longitude: 108.94, province: '陕西' },
  { name: '宝鸡', timezone: 'Asia/Shanghai', longitude: 107.24, province: '陕西' },
  { name: '咸阳', timezone: 'Asia/Shanghai', longitude: 108.71, province: '陕西' },
  { name: '渭南', timezone: 'Asia/Shanghai', longitude: 109.51, province: '陕西' },
  { name: '延安', timezone: 'Asia/Shanghai', longitude: 109.49, province: '陕西' },
  { name: '汉中', timezone: 'Asia/Shanghai', longitude: 107.03, province: '陕西' },
  { name: '榆林', timezone: 'Asia/Shanghai', longitude: 109.73, province: '陕西' },
  { name: '安康', timezone: 'Asia/Shanghai', longitude: 109.03, province: '陕西' },
  { name: '商洛', timezone: 'Asia/Shanghai', longitude: 109.94, province: '陕西' },

  // ── 甘肃省 ──
  { name: '嘉峪关', timezone: 'Asia/Shanghai', longitude: 98.29, province: '甘肃' },
  { name: '金昌', timezone: 'Asia/Shanghai', longitude: 102.19, province: '甘肃' },
  { name: '白银', timezone: 'Asia/Shanghai', longitude: 104.14, province: '甘肃' },
  { name: '天水', timezone: 'Asia/Shanghai', longitude: 105.72, province: '甘肃' },
  { name: '武威', timezone: 'Asia/Shanghai', longitude: 102.64, province: '甘肃' },
  { name: '张掖', timezone: 'Asia/Shanghai', longitude: 100.45, province: '甘肃' },
  { name: '平凉', timezone: 'Asia/Shanghai', longitude: 106.67, province: '甘肃' },
  { name: '酒泉', timezone: 'Asia/Shanghai', longitude: 98.51, province: '甘肃' },
  { name: '庆阳', timezone: 'Asia/Shanghai', longitude: 107.64, province: '甘肃' },
  { name: '定西', timezone: 'Asia/Shanghai', longitude: 104.63, province: '甘肃' },
  { name: '陇南', timezone: 'Asia/Shanghai', longitude: 104.92, province: '甘肃' },
  { name: '临夏', timezone: 'Asia/Shanghai', longitude: 103.21, province: '甘肃' },
  { name: '甘南', timezone: 'Asia/Shanghai', longitude: 102.91, province: '甘肃' },

  // ── 青海省 ──
  { name: '海东', timezone: 'Asia/Shanghai', longitude: 102.10, province: '青海' },
  { name: '海北', timezone: 'Asia/Shanghai', longitude: 100.90, province: '青海' },
  { name: '黄南', timezone: 'Asia/Shanghai', longitude: 102.02, province: '青海' },
  { name: '海南州', timezone: 'Asia/Shanghai', longitude: 100.62, province: '青海' },
  { name: '果洛', timezone: 'Asia/Shanghai', longitude: 100.24, province: '青海' },
  { name: '玉树', timezone: 'Asia/Shanghai', longitude: 97.01, province: '青海' },
  { name: '海西', timezone: 'Asia/Shanghai', longitude: 97.37, province: '青海' },

  // ── 宁夏回族自治区 ──
  { name: '石嘴山', timezone: 'Asia/Shanghai', longitude: 106.38, province: '宁夏' },
  { name: '吴忠', timezone: 'Asia/Shanghai', longitude: 106.20, province: '宁夏' },
  { name: '固原', timezone: 'Asia/Shanghai', longitude: 106.24, province: '宁夏' },
  { name: '中卫', timezone: 'Asia/Shanghai', longitude: 105.20, province: '宁夏' },

  // ── 新疆维吾尔自治区 ──
  { name: '克拉玛依', timezone: 'Asia/Shanghai', longitude: 84.87, province: '新疆' },
  { name: '吐鲁番', timezone: 'Asia/Shanghai', longitude: 89.19, province: '新疆' },
  { name: '哈密', timezone: 'Asia/Shanghai', longitude: 93.51, province: '新疆' },
  { name: '昌吉', timezone: 'Asia/Shanghai', longitude: 87.31, province: '新疆' },
  { name: '博尔塔拉', timezone: 'Asia/Shanghai', longitude: 82.07, province: '新疆' },
  { name: '博乐', timezone: 'Asia/Shanghai', longitude: 82.07, province: '新疆' },
  { name: '巴音郭楞', timezone: 'Asia/Shanghai', longitude: 86.15, province: '新疆' },
  { name: '库尔勒', timezone: 'Asia/Shanghai', longitude: 86.15, province: '新疆' },
  { name: '阿克苏', timezone: 'Asia/Shanghai', longitude: 80.26, province: '新疆' },
  { name: '克孜勒苏', timezone: 'Asia/Shanghai', longitude: 76.17, province: '新疆' },
  { name: '阿图什', timezone: 'Asia/Shanghai', longitude: 76.17, province: '新疆' },
  { name: '喀什', timezone: 'Asia/Shanghai', longitude: 75.99, province: '新疆' },
  { name: '和田', timezone: 'Asia/Shanghai', longitude: 79.93, province: '新疆' },
  { name: '伊犁', timezone: 'Asia/Shanghai', longitude: 81.33, province: '新疆' },
  { name: '伊宁', timezone: 'Asia/Shanghai', longitude: 81.33, province: '新疆' },
  { name: '塔城', timezone: 'Asia/Shanghai', longitude: 82.99, province: '新疆' },
  { name: '阿勒泰', timezone: 'Asia/Shanghai', longitude: 88.14, province: '新疆' },
  { name: '石河子', timezone: 'Asia/Shanghai', longitude: 86.04, province: '新疆' },
  { name: '阿拉尔', timezone: 'Asia/Shanghai', longitude: 81.29, province: '新疆' },
  { name: '图木舒克', timezone: 'Asia/Shanghai', longitude: 79.07, province: '新疆' },
  { name: '五家渠', timezone: 'Asia/Shanghai', longitude: 87.53, province: '新疆' },
  { name: '北屯', timezone: 'Asia/Shanghai', longitude: 87.82, province: '新疆' },
  { name: '铁门关', timezone: 'Asia/Shanghai', longitude: 85.67, province: '新疆' },
  { name: '双河', timezone: 'Asia/Shanghai', longitude: 82.35, province: '新疆' },
  { name: '可克达拉', timezone: 'Asia/Shanghai', longitude: 80.63, province: '新疆' },
  { name: '昆玉', timezone: 'Asia/Shanghai', longitude: 79.29, province: '新疆' },
  { name: '胡杨河', timezone: 'Asia/Shanghai', longitude: 84.83, province: '新疆' },
  { name: '新星', timezone: 'Asia/Shanghai', longitude: 86.18, province: '新疆' },

  // ── 台湾省 ──
  { name: '高雄', timezone: 'Asia/Taipei', longitude: 120.31, province: '台湾' },
  { name: '台中', timezone: 'Asia/Taipei', longitude: 120.68, province: '台湾' },
  { name: '台南', timezone: 'Asia/Taipei', longitude: 120.23, province: '台湾' },
  { name: '新北', timezone: 'Asia/Taipei', longitude: 121.47, province: '台湾' },
  { name: '桃园', timezone: 'Asia/Taipei', longitude: 121.30, province: '台湾' },
  { name: '基隆', timezone: 'Asia/Taipei', longitude: 121.74, province: '台湾' },
  { name: '新竹', timezone: 'Asia/Taipei', longitude: 120.97, province: '台湾' },
  { name: '嘉义', timezone: 'Asia/Taipei', longitude: 120.45, province: '台湾' },
  { name: '花莲', timezone: 'Asia/Taipei', longitude: 121.60, province: '台湾' },
  { name: '台东', timezone: 'Asia/Taipei', longitude: 121.15, province: '台湾' },

  // ════════════════════════════════════════════════════════════
  // 海外城市（中英文双条目）
  // ════════════════════════════════════════════════════════════

  // ── 东亚 ──
  { name: '东京', timezone: 'Asia/Tokyo', longitude: 139.69 },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', longitude: 139.69 },
  { name: '大阪', timezone: 'Asia/Tokyo', longitude: 135.50 },
  { name: 'Osaka', timezone: 'Asia/Tokyo', longitude: 135.50 },
  { name: '京都', timezone: 'Asia/Tokyo', longitude: 135.77 },
  { name: 'Kyoto', timezone: 'Asia/Tokyo', longitude: 135.77 },
  { name: '名古屋', timezone: 'Asia/Tokyo', longitude: 136.91 },
  { name: 'Nagoya', timezone: 'Asia/Tokyo', longitude: 136.91 },
  { name: '横滨', timezone: 'Asia/Tokyo', longitude: 139.64 },
  { name: 'Yokohama', timezone: 'Asia/Tokyo', longitude: 139.64 },
  { name: '札幌', timezone: 'Asia/Tokyo', longitude: 141.35 },
  { name: 'Sapporo', timezone: 'Asia/Tokyo', longitude: 141.35 },
  { name: '福冈', timezone: 'Asia/Tokyo', longitude: 130.42 },
  { name: 'Fukuoka', timezone: 'Asia/Tokyo', longitude: 130.42 },
  { name: '首尔', timezone: 'Asia/Seoul', longitude: 126.98 },
  { name: 'Seoul', timezone: 'Asia/Seoul', longitude: 126.98 },
  { name: '釜山', timezone: 'Asia/Seoul', longitude: 129.08 },
  { name: 'Busan', timezone: 'Asia/Seoul', longitude: 129.08 },
  { name: '仁川', timezone: 'Asia/Seoul', longitude: 126.71 },
  { name: 'Incheon', timezone: 'Asia/Seoul', longitude: 126.71 },
  { name: '平壤', timezone: 'Asia/Pyongyang', longitude: 125.75 },
  { name: 'Pyongyang', timezone: 'Asia/Pyongyang', longitude: 125.75 },
  { name: '乌兰巴托', timezone: 'Asia/Ulaanbaatar', longitude: 106.91 },
  { name: 'Ulaanbaatar', timezone: 'Asia/Ulaanbaatar', longitude: 106.91 },

  // ── 东南亚 ──
  { name: '新加坡', timezone: 'Asia/Singapore', longitude: 103.85 },
  { name: 'Singapore', timezone: 'Asia/Singapore', longitude: 103.85 },
  { name: '曼谷', timezone: 'Asia/Bangkok', longitude: 100.50 },
  { name: 'Bangkok', timezone: 'Asia/Bangkok', longitude: 100.50 },
  { name: '吉隆坡', timezone: 'Asia/Kuala_Lumpur', longitude: 101.69 },
  { name: 'Kuala Lumpur', timezone: 'Asia/Kuala_Lumpur', longitude: 101.69 },
  { name: '雅加达', timezone: 'Asia/Jakarta', longitude: 106.85 },
  { name: 'Jakarta', timezone: 'Asia/Jakarta', longitude: 106.85 },
  { name: '马尼拉', timezone: 'Asia/Manila', longitude: 120.98 },
  { name: 'Manila', timezone: 'Asia/Manila', longitude: 120.98 },
  { name: '河内', timezone: 'Asia/Ho_Chi_Minh', longitude: 105.85 },
  { name: 'Hanoi', timezone: 'Asia/Ho_Chi_Minh', longitude: 105.85 },
  { name: '胡志明市', timezone: 'Asia/Ho_Chi_Minh', longitude: 106.63 },
  { name: 'Ho Chi Minh City', timezone: 'Asia/Ho_Chi_Minh', longitude: 106.63 },
  { name: '金边', timezone: 'Asia/Phnom_Penh', longitude: 104.92 },
  { name: 'Phnom Penh', timezone: 'Asia/Phnom_Penh', longitude: 104.92 },
  { name: '万象', timezone: 'Asia/Vientiane', longitude: 102.63 },
  { name: 'Vientiane', timezone: 'Asia/Vientiane', longitude: 102.63 },
  { name: '仰光', timezone: 'Asia/Yangon', longitude: 96.20 },
  { name: 'Yangon', timezone: 'Asia/Yangon', longitude: 96.20 },
  { name: '内比都', timezone: 'Asia/Yangon', longitude: 96.13 },
  { name: 'Naypyidaw', timezone: 'Asia/Yangon', longitude: 96.13 },

  // ── 南亚 / 中亚 / 西亚 ──
  { name: '新德里', timezone: 'Asia/Kolkata', longitude: 77.21 },
  { name: 'New Delhi', timezone: 'Asia/Kolkata', longitude: 77.21 },
  { name: '孟买', timezone: 'Asia/Kolkata', longitude: 72.88 },
  { name: 'Mumbai', timezone: 'Asia/Kolkata', longitude: 72.88 },
  { name: '班加罗尔', timezone: 'Asia/Kolkata', longitude: 77.59 },
  { name: 'Bangalore', timezone: 'Asia/Kolkata', longitude: 77.59 },
  { name: '加尔各答', timezone: 'Asia/Kolkata', longitude: 88.36 },
  { name: 'Kolkata', timezone: 'Asia/Kolkata', longitude: 88.36 },
  { name: '伊斯兰堡', timezone: 'Asia/Karachi', longitude: 73.05 },
  { name: 'Islamabad', timezone: 'Asia/Karachi', longitude: 73.05 },
  { name: '卡拉奇', timezone: 'Asia/Karachi', longitude: 67.01 },
  { name: 'Karachi', timezone: 'Asia/Karachi', longitude: 67.01 },
  { name: '达卡', timezone: 'Asia/Dhaka', longitude: 90.41 },
  { name: 'Dhaka', timezone: 'Asia/Dhaka', longitude: 90.41 },
  { name: '科伦坡', timezone: 'Asia/Colombo', longitude: 79.86 },
  { name: 'Colombo', timezone: 'Asia/Colombo', longitude: 79.86 },
  { name: '加德满都', timezone: 'Asia/Kathmandu', longitude: 85.32 },
  { name: 'Kathmandu', timezone: 'Asia/Kathmandu', longitude: 85.32 },
  { name: '迪拜', timezone: 'Asia/Dubai', longitude: 55.27 },
  { name: 'Dubai', timezone: 'Asia/Dubai', longitude: 55.27 },
  { name: '阿布扎比', timezone: 'Asia/Dubai', longitude: 54.37 },
  { name: 'Abu Dhabi', timezone: 'Asia/Dubai', longitude: 54.37 },
  { name: '利雅得', timezone: 'Asia/Riyadh', longitude: 46.72 },
  { name: 'Riyadh', timezone: 'Asia/Riyadh', longitude: 46.72 },
  { name: '德黑兰', timezone: 'Asia/Tehran', longitude: 51.39 },
  { name: 'Tehran', timezone: 'Asia/Tehran', longitude: 51.39 },
  { name: '安卡拉', timezone: 'Europe/Istanbul', longitude: 32.87 },
  { name: 'Ankara', timezone: 'Europe/Istanbul', longitude: 32.87 },
  { name: '伊斯坦布尔', timezone: 'Europe/Istanbul', longitude: 28.98 },
  { name: 'Istanbul', timezone: 'Europe/Istanbul', longitude: 28.98 },
  { name: '特拉维夫', timezone: 'Asia/Jerusalem', longitude: 34.78 },
  { name: 'Tel Aviv', timezone: 'Asia/Jerusalem', longitude: 34.78 },

  // ── 欧洲 ──
  { name: '伦敦', timezone: 'Europe/London', longitude: -0.12 },
  { name: 'London', timezone: 'Europe/London', longitude: -0.12 },
  { name: '巴黎', timezone: 'Europe/Paris', longitude: 2.35 },
  { name: 'Paris', timezone: 'Europe/Paris', longitude: 2.35 },
  { name: '柏林', timezone: 'Europe/Berlin', longitude: 13.40 },
  { name: 'Berlin', timezone: 'Europe/Berlin', longitude: 13.40 },
  { name: '莫斯科', timezone: 'Europe/Moscow', longitude: 37.62 },
  { name: 'Moscow', timezone: 'Europe/Moscow', longitude: 37.62 },
  { name: '罗马', timezone: 'Europe/Rome', longitude: 12.50 },
  { name: 'Rome', timezone: 'Europe/Rome', longitude: 12.50 },
  { name: '马德里', timezone: 'Europe/Madrid', longitude: -3.70 },
  { name: 'Madrid', timezone: 'Europe/Madrid', longitude: -3.70 },
  { name: '阿姆斯特丹', timezone: 'Europe/Amsterdam', longitude: 4.90 },
  { name: 'Amsterdam', timezone: 'Europe/Amsterdam', longitude: 4.90 },
  { name: '布鲁塞尔', timezone: 'Europe/Brussels', longitude: 4.35 },
  { name: 'Brussels', timezone: 'Europe/Brussels', longitude: 4.35 },
  { name: '维也纳', timezone: 'Europe/Vienna', longitude: 16.37 },
  { name: 'Vienna', timezone: 'Europe/Vienna', longitude: 16.37 },
  { name: '苏黎世', timezone: 'Europe/Zurich', longitude: 8.54 },
  { name: 'Zurich', timezone: 'Europe/Zurich', longitude: 8.54 },
  { name: '日内瓦', timezone: 'Europe/Zurich', longitude: 6.14 },
  { name: 'Geneva', timezone: 'Europe/Zurich', longitude: 6.14 },
  { name: '里斯本', timezone: 'Europe/Lisbon', longitude: -9.14 },
  { name: 'Lisbon', timezone: 'Europe/Lisbon', longitude: -9.14 },
  { name: '巴塞罗那', timezone: 'Europe/Madrid', longitude: 2.17 },
  { name: 'Barcelona', timezone: 'Europe/Madrid', longitude: 2.17 },
  { name: '米兰', timezone: 'Europe/Rome', longitude: 9.19 },
  { name: 'Milan', timezone: 'Europe/Rome', longitude: 9.19 },
  { name: '慕尼黑', timezone: 'Europe/Berlin', longitude: 11.58 },
  { name: 'Munich', timezone: 'Europe/Berlin', longitude: 11.58 },
  { name: '法兰克福', timezone: 'Europe/Berlin', longitude: 8.68 },
  { name: 'Frankfurt', timezone: 'Europe/Berlin', longitude: 8.68 },
  { name: '汉堡', timezone: 'Europe/Berlin', longitude: 9.99 },
  { name: 'Hamburg', timezone: 'Europe/Berlin', longitude: 9.99 },
  { name: '斯德哥尔摩', timezone: 'Europe/Stockholm', longitude: 18.07 },
  { name: 'Stockholm', timezone: 'Europe/Stockholm', longitude: 18.07 },
  { name: '奥斯陆', timezone: 'Europe/Oslo', longitude: 10.75 },
  { name: 'Oslo', timezone: 'Europe/Oslo', longitude: 10.75 },
  { name: '哥本哈根', timezone: 'Europe/Copenhagen', longitude: 12.57 },
  { name: 'Copenhagen', timezone: 'Europe/Copenhagen', longitude: 12.57 },
  { name: '赫尔辛基', timezone: 'Europe/Helsinki', longitude: 24.94 },
  { name: 'Helsinki', timezone: 'Europe/Helsinki', longitude: 24.94 },
  { name: '华沙', timezone: 'Europe/Warsaw', longitude: 21.01 },
  { name: 'Warsaw', timezone: 'Europe/Warsaw', longitude: 21.01 },
  { name: '布拉格', timezone: 'Europe/Prague', longitude: 14.42 },
  { name: 'Prague', timezone: 'Europe/Prague', longitude: 14.42 },
  { name: '布达佩斯', timezone: 'Europe/Budapest', longitude: 19.04 },
  { name: 'Budapest', timezone: 'Europe/Budapest', longitude: 19.04 },
  { name: '雅典', timezone: 'Europe/Athens', longitude: 23.73 },
  { name: 'Athens', timezone: 'Europe/Athens', longitude: 23.73 },
  { name: '都柏林', timezone: 'Europe/Dublin', longitude: -6.26 },
  { name: 'Dublin', timezone: 'Europe/Dublin', longitude: -6.26 },
  { name: '爱丁堡', timezone: 'Europe/London', longitude: -3.19 },
  { name: 'Edinburgh', timezone: 'Europe/London', longitude: -3.19 },
  { name: '曼彻斯特', timezone: 'Europe/London', longitude: -2.24 },
  { name: 'Manchester', timezone: 'Europe/London', longitude: -2.24 },
  { name: '基辅', timezone: 'Europe/Kyiv', longitude: 30.52 },
  { name: 'Kyiv', timezone: 'Europe/Kyiv', longitude: 30.52 },
  { name: '布加勒斯特', timezone: 'Europe/Bucharest', longitude: 26.10 },
  { name: 'Bucharest', timezone: 'Europe/Bucharest', longitude: 26.10 },
  { name: '贝尔格莱德', timezone: 'Europe/Belgrade', longitude: 20.46 },
  { name: 'Belgrade', timezone: 'Europe/Belgrade', longitude: 20.46 },
  { name: '圣彼得堡', timezone: 'Europe/Moscow', longitude: 30.32 },
  { name: 'Saint Petersburg', timezone: 'Europe/Moscow', longitude: 30.32 },

  // ── 北美 — 美国 ──
  { name: '纽约', timezone: 'America/New_York', longitude: -74.01 },
  { name: 'New York', timezone: 'America/New_York', longitude: -74.01 },
  { name: '洛杉矶', timezone: 'America/Los_Angeles', longitude: -118.24 },
  { name: 'Los Angeles', timezone: 'America/Los_Angeles', longitude: -118.24 },
  { name: '芝加哥', timezone: 'America/Chicago', longitude: -87.63 },
  { name: 'Chicago', timezone: 'America/Chicago', longitude: -87.63 },
  { name: '休斯顿', timezone: 'America/Chicago', longitude: -95.37 },
  { name: 'Houston', timezone: 'America/Chicago', longitude: -95.37 },
  { name: '凤凰城', timezone: 'America/Phoenix', longitude: -112.07 },
  { name: 'Phoenix', timezone: 'America/Phoenix', longitude: -112.07 },
  { name: '费城', timezone: 'America/New_York', longitude: -75.16 },
  { name: 'Philadelphia', timezone: 'America/New_York', longitude: -75.16 },
  { name: '圣安东尼奥', timezone: 'America/Chicago', longitude: -98.49 },
  { name: 'San Antonio', timezone: 'America/Chicago', longitude: -98.49 },
  { name: '圣迭戈', timezone: 'America/Los_Angeles', longitude: -117.16 },
  { name: 'San Diego', timezone: 'America/Los_Angeles', longitude: -117.16 },
  { name: '达拉斯', timezone: 'America/Chicago', longitude: -96.80 },
  { name: 'Dallas', timezone: 'America/Chicago', longitude: -96.80 },
  { name: '旧金山', timezone: 'America/Los_Angeles', longitude: -122.42 },
  { name: 'San Francisco', timezone: 'America/Los_Angeles', longitude: -122.42 },
  { name: '西雅图', timezone: 'America/Los_Angeles', longitude: -122.33 },
  { name: 'Seattle', timezone: 'America/Los_Angeles', longitude: -122.33 },
  { name: '华盛顿', timezone: 'America/New_York', longitude: -77.04 },
  { name: 'Washington D.C.', timezone: 'America/New_York', longitude: -77.04 },
  { name: '波士顿', timezone: 'America/New_York', longitude: -71.06 },
  { name: 'Boston', timezone: 'America/New_York', longitude: -71.06 },
  { name: '亚特兰大', timezone: 'America/New_York', longitude: -84.39 },
  { name: 'Atlanta', timezone: 'America/New_York', longitude: -84.39 },
  { name: '迈阿密', timezone: 'America/New_York', longitude: -80.19 },
  { name: 'Miami', timezone: 'America/New_York', longitude: -80.19 },
  { name: '丹佛', timezone: 'America/Denver', longitude: -104.99 },
  { name: 'Denver', timezone: 'America/Denver', longitude: -104.99 },
  { name: '拉斯维加斯', timezone: 'America/Los_Angeles', longitude: -115.14 },
  { name: 'Las Vegas', timezone: 'America/Los_Angeles', longitude: -115.14 },
  { name: '波特兰', timezone: 'America/Los_Angeles', longitude: -122.68 },
  { name: 'Portland', timezone: 'America/Los_Angeles', longitude: -122.68 },
  { name: '底特律', timezone: 'America/Detroit', longitude: -83.05 },
  { name: 'Detroit', timezone: 'America/Detroit', longitude: -83.05 },
  { name: '明尼阿波利斯', timezone: 'America/Chicago', longitude: -93.27 },
  { name: 'Minneapolis', timezone: 'America/Chicago', longitude: -93.27 },
  { name: '奥斯汀', timezone: 'America/Chicago', longitude: -97.74 },
  { name: 'Austin', timezone: 'America/Chicago', longitude: -97.74 },
  { name: '纳什维尔', timezone: 'America/Chicago', longitude: -86.78 },
  { name: 'Nashville', timezone: 'America/Chicago', longitude: -86.78 },
  { name: '盐湖城', timezone: 'America/Denver', longitude: -111.89 },
  { name: 'Salt Lake City', timezone: 'America/Denver', longitude: -111.89 },
  { name: '匹兹堡', timezone: 'America/New_York', longitude: -79.99 },
  { name: 'Pittsburgh', timezone: 'America/New_York', longitude: -79.99 },
  { name: '夏洛特', timezone: 'America/New_York', longitude: -80.84 },
  { name: 'Charlotte', timezone: 'America/New_York', longitude: -80.84 },
  { name: '印第安纳波利斯', timezone: 'America/Indiana/Indianapolis', longitude: -86.16 },
  { name: 'Indianapolis', timezone: 'America/Indiana/Indianapolis', longitude: -86.16 },
  { name: '哥伦布', timezone: 'America/New_York', longitude: -82.99 },
  { name: 'Columbus', timezone: 'America/New_York', longitude: -82.99 },
  { name: '堪萨斯城', timezone: 'America/Chicago', longitude: -94.58 },
  { name: 'Kansas City', timezone: 'America/Chicago', longitude: -94.58 },
  { name: '檀香山', timezone: 'Pacific/Honolulu', longitude: -157.86 },
  { name: 'Honolulu', timezone: 'Pacific/Honolulu', longitude: -157.86 },
  { name: '安克雷奇', timezone: 'America/Anchorage', longitude: -149.90 },
  { name: 'Anchorage', timezone: 'America/Anchorage', longitude: -149.90 },

  // ── 北美 — 加拿大 ──
  { name: '多伦多', timezone: 'America/Toronto', longitude: -79.38 },
  { name: 'Toronto', timezone: 'America/Toronto', longitude: -79.38 },
  { name: '温哥华', timezone: 'America/Vancouver', longitude: -123.12 },
  { name: 'Vancouver', timezone: 'America/Vancouver', longitude: -123.12 },
  { name: '蒙特利尔', timezone: 'America/Toronto', longitude: -73.57 },
  { name: 'Montreal', timezone: 'America/Toronto', longitude: -73.57 },
  { name: '渥太华', timezone: 'America/Toronto', longitude: -75.70 },
  { name: 'Ottawa', timezone: 'America/Toronto', longitude: -75.70 },
  { name: '卡尔加里', timezone: 'America/Edmonton', longitude: -114.07 },
  { name: 'Calgary', timezone: 'America/Edmonton', longitude: -114.07 },
  { name: '埃德蒙顿', timezone: 'America/Edmonton', longitude: -113.49 },
  { name: 'Edmonton', timezone: 'America/Edmonton', longitude: -113.49 },
  { name: '温尼伯', timezone: 'America/Winnipeg', longitude: -97.14 },
  { name: 'Winnipeg', timezone: 'America/Winnipeg', longitude: -97.14 },

  // ── 北美 — 墨西哥 ──
  { name: '墨西哥城', timezone: 'America/Mexico_City', longitude: -99.13 },
  { name: 'Mexico City', timezone: 'America/Mexico_City', longitude: -99.13 },

  // ── 南美 ──
  { name: '圣保罗', timezone: 'America/Sao_Paulo', longitude: -46.63 },
  { name: 'São Paulo', timezone: 'America/Sao_Paulo', longitude: -46.63 },
  { name: 'Sao Paulo', timezone: 'America/Sao_Paulo', longitude: -46.63 },
  { name: '里约热内卢', timezone: 'America/Sao_Paulo', longitude: -43.17 },
  { name: 'Rio de Janeiro', timezone: 'America/Sao_Paulo', longitude: -43.17 },
  { name: '布宜诺斯艾利斯', timezone: 'America/Argentina/Buenos_Aires', longitude: -58.38 },
  { name: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires', longitude: -58.38 },
  { name: '圣地亚哥', timezone: 'America/Santiago', longitude: -70.67 },
  { name: 'Santiago', timezone: 'America/Santiago', longitude: -70.67 },
  { name: '利马', timezone: 'America/Lima', longitude: -77.04 },
  { name: 'Lima', timezone: 'America/Lima', longitude: -77.04 },
  { name: '波哥大', timezone: 'America/Bogota', longitude: -74.07 },
  { name: 'Bogotá', timezone: 'America/Bogota', longitude: -74.07 },
  { name: 'Bogota', timezone: 'America/Bogota', longitude: -74.07 },

  // ── 非洲 ──
  { name: '开罗', timezone: 'Africa/Cairo', longitude: 31.24 },
  { name: 'Cairo', timezone: 'Africa/Cairo', longitude: 31.24 },
  { name: '约翰内斯堡', timezone: 'Africa/Johannesburg', longitude: 28.05 },
  { name: 'Johannesburg', timezone: 'Africa/Johannesburg', longitude: 28.05 },
  { name: '开普敦', timezone: 'Africa/Johannesburg', longitude: 18.42 },
  { name: 'Cape Town', timezone: 'Africa/Johannesburg', longitude: 18.42 },
  { name: '拉各斯', timezone: 'Africa/Lagos', longitude: 3.39 },
  { name: 'Lagos', timezone: 'Africa/Lagos', longitude: 3.39 },
  { name: '内罗毕', timezone: 'Africa/Nairobi', longitude: 36.82 },
  { name: 'Nairobi', timezone: 'Africa/Nairobi', longitude: 36.82 },
  { name: '卡萨布兰卡', timezone: 'Africa/Casablanca', longitude: -7.59 },
  { name: 'Casablanca', timezone: 'Africa/Casablanca', longitude: -7.59 },

  // ── 大洋洲 ──
  { name: '悉尼', timezone: 'Australia/Sydney', longitude: 151.21 },
  { name: 'Sydney', timezone: 'Australia/Sydney', longitude: 151.21 },
  { name: '墨尔本', timezone: 'Australia/Melbourne', longitude: 144.96 },
  { name: 'Melbourne', timezone: 'Australia/Melbourne', longitude: 144.96 },
  { name: '布里斯班', timezone: 'Australia/Brisbane', longitude: 153.03 },
  { name: 'Brisbane', timezone: 'Australia/Brisbane', longitude: 153.03 },
  { name: '珀斯', timezone: 'Australia/Perth', longitude: 115.86 },
  { name: 'Perth', timezone: 'Australia/Perth', longitude: 115.86 },
  { name: '阿德莱德', timezone: 'Australia/Adelaide', longitude: 138.60 },
  { name: 'Adelaide', timezone: 'Australia/Adelaide', longitude: 138.60 },
  { name: '奥克兰', timezone: 'Pacific/Auckland', longitude: 174.76 },
  { name: 'Auckland', timezone: 'Pacific/Auckland', longitude: 174.76 },
  { name: '惠灵顿', timezone: 'Pacific/Auckland', longitude: 174.78 },
  { name: 'Wellington', timezone: 'Pacific/Auckland', longitude: 174.78 },
];

const CITY_ALIAS_TO_PREFECTURE = {
  // 安徽省马鞍山市下辖县区。县区经度与马鞍山市区接近，优先使用地级市经度做地方平太阳时校正。
  '当涂': '马鞍山',
  '当涂县': '马鞍山',
  '含山': '马鞍山',
  '含山县': '马鞍山',
  '和县': '马鞍山',
  '博望': '马鞍山',
  '博望区': '马鞍山',
  '花山': '马鞍山',
  '花山区': '马鞍山',
  '雨山': '马鞍山',
  '雨山区': '马鞍山'
};

function normalizePlaceName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[·•,，、/／\\|｜]+/g, '-')
    .replace(/^中国/, '')
    .replace(/^(北京市|上海市|天津市|重庆市)/, match => match.slice(0, -1));
}

function getAliasTarget(name) {
  const normalized = normalizePlaceName(name);
  if (CITY_ALIAS_TO_PREFECTURE[normalized]) return CITY_ALIAS_TO_PREFECTURE[normalized];

  for (const [alias, target] of Object.entries(CITY_ALIAS_TO_PREFECTURE)) {
    if (normalized.includes(alias)) return target;
  }

  return null;
}

export function findCity(name) {
  if (!name) return null;

  const normalized = normalizePlaceName(name);

  if (!normalized) return null;

  const exact = CITY_DB.find(c => c.name === name || c.name === normalized);
  if (exact) return exact;

  const aliasTarget = getAliasTarget(normalized);
  if (aliasTarget) {
    const byAlias = CITY_DB.find(c => c.name === aliasTarget);
    if (byAlias) return byAlias;
  }

  // 包含匹配（如 "上海市" 匹配 "上海"，"马鞍山-当涂" 匹配 "马鞍山"）
  const partial = CITY_DB.find(c => normalized.includes(c.name) || c.name.includes(normalized));
  if (partial) return partial;

  // 省份匹配（如 "辽宁" 匹配该省表内第一个城市；仅作为最后降级）
  const byProvince = CITY_DB.find(c => c.province && (normalized.includes(c.province) || c.province.includes(normalized)));
  return byProvince || null;
}

// ─── 时区标准经度映射 ───────────────────────────────────────
// Legacy contemporary display values only; normalization derives historical meridians from IANA.
// UTC offset (hours) × 15 = standard longitude
// 某些时区的标准经度不是简单的 offset × 15，需要特殊处理
export const TZ_STANDARD_LONGITUDE = {
  // 中国 / 东亚
  'Asia/Shanghai': 120,        // UTC+8 → 120°E
  'Asia/Taipei': 120,
  'Asia/Hong_Kong': 120,
  'Asia/Macau': 120,
  'Asia/Tokyo': 135,           // UTC+9 → 135°E
  'Asia/Seoul': 135,           // UTC+9
  'Asia/Pyongyang': 135,       // UTC+9
  'Asia/Ulaanbaatar': 120,    // UTC+8

  // 东南亚
  'Asia/Singapore': 120,       // UTC+8（地理 ~104°E）
  'Asia/Kuala_Lumpur': 120,    // UTC+8
  'Asia/Bangkok': 105,         // UTC+7 → 105°E
  'Asia/Jakarta': 105,         // UTC+7 (WIB)
  'Asia/Manila': 120,          // UTC+8
  'Asia/Ho_Chi_Minh': 105,     // UTC+7
  'Asia/Phnom_Penh': 105,      // UTC+7
  'Asia/Vientiane': 105,       // UTC+7
  'Asia/Yangon': 97.5,         // UTC+6:30 → 97.5°E

  // 南亚 / 中亚 / 西亚
  'Asia/Kolkata': 82.5,        // UTC+5:30 → 82.5°E
  'Asia/Karachi': 75,          // UTC+5 → 75°E
  'Asia/Dhaka': 90,            // UTC+6 → 90°E
  'Asia/Colombo': 82.5,        // UTC+5:30
  'Asia/Kathmandu': 86.25,     // UTC+5:45 → 86.25°E
  'Asia/Dubai': 60,            // UTC+4 → 60°E
  'Asia/Riyadh': 45,           // UTC+3 → 45°E
  'Asia/Tehran': 52.5,         // UTC+3:30 → 52.5°E
  'Asia/Jerusalem': 30,        // UTC+2 → 30°E
  'Europe/Istanbul': 45,       // UTC+3 → 45°E; historical offsets vary

  // 欧洲
  'Europe/London': 0,          // UTC+0 → 0°
  'Europe/Dublin': 0,          // UTC+0
  'Europe/Lisbon': 0,          // UTC+0
  'Europe/Paris': 15,          // UTC+1 → 15°E
  'Europe/Berlin': 15,         // UTC+1
  'Europe/Rome': 15,           // UTC+1
  'Europe/Madrid': 15,         // UTC+1（地理 ~-4°，但用 CET）
  'Europe/Amsterdam': 15,      // UTC+1
  'Europe/Brussels': 15,       // UTC+1
  'Europe/Vienna': 15,         // UTC+1
  'Europe/Zurich': 15,         // UTC+1
  'Europe/Stockholm': 15,      // UTC+1
  'Europe/Oslo': 15,           // UTC+1
  'Europe/Copenhagen': 15,     // UTC+1
  'Europe/Warsaw': 15,         // UTC+1
  'Europe/Prague': 15,         // UTC+1
  'Europe/Budapest': 15,       // UTC+1
  'Europe/Belgrade': 15,       // UTC+1
  'Europe/Helsinki': 30,       // UTC+2 → 30°E
  'Europe/Athens': 30,         // UTC+2
  'Europe/Bucharest': 30,      // UTC+2
  'Europe/Kyiv': 30,           // UTC+2
  'Europe/Moscow': 45,         // UTC+3 → 45°E

  // 北美
  'America/New_York': -75,     // UTC-5 → -75°W
  'America/Chicago': -90,      // UTC-6 → -90°W
  'America/Denver': -105,      // UTC-7 → -105°W
  'America/Los_Angeles': -120, // UTC-8 → -120°W
  'America/Phoenix': -105,     // UTC-7（无 DST）
  'America/Detroit': -75,      // UTC-5
  'America/Indiana/Indianapolis': -75, // UTC-5
  'America/Anchorage': -135,   // UTC-9 → -135°W
  'Pacific/Honolulu': -150,    // UTC-10 → -150°W
  'America/Toronto': -75,      // UTC-5
  'America/Vancouver': -120,   // UTC-8
  'America/Edmonton': -105,    // UTC-7
  'America/Winnipeg': -90,     // UTC-6
  'America/Mexico_City': -90,  // UTC-6

  // 南美
  'America/Sao_Paulo': -45,    // UTC-3 → -45°W
  'America/Argentina/Buenos_Aires': -45, // UTC-3
  'America/Santiago': -60,     // UTC-4 → -60°W
  'America/Lima': -75,         // UTC-5 → -75°W
  'America/Bogota': -75,       // UTC-5

  // 非洲
  'Africa/Cairo': 30,          // UTC+2 → 30°E
  'Africa/Johannesburg': 30,   // UTC+2
  'Africa/Lagos': 15,          // UTC+1
  'Africa/Nairobi': 45,        // UTC+3 → 45°E
  'Africa/Casablanca': 0,      // UTC+0/+1

  // 大洋洲
  'Australia/Sydney': 150,     // UTC+10 → 150°E
  'Australia/Melbourne': 150,  // UTC+10
  'Australia/Brisbane': 150,   // UTC+10
  'Australia/Perth': 120,      // UTC+8 → 120°E
  'Australia/Adelaide': 142.5, // UTC+9:30 → 142.5°E (actually 138.5 but standard is 142.5)
  'Pacific/Auckland': 180,     // UTC+12 → 180°E
};
