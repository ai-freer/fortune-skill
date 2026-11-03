"""Independent lunar-python calculation using the declared clock contract."""
from lunar_python import Solar, EightChar


def calendar_basis(context):
    def lunar_at(clock):
        year, month, day = map(int, clock['solar'].split('-'))
        return Solar.fromYmdHms(year, month, day, clock['hour'], clock['minute'],
                               clock.get('second', 0)).getLunar()

    apparent = lunar_at(context['corrected'])
    physical = lunar_at(context['calendarReference'])

    class MixedLunar:
        def __getattr__(self, name):
            source = physical if name.startswith(('getYear', 'getMonth')) and 'Exact' in name else apparent
            return getattr(source, name)

    class CalendarEightChar(EightChar):
        def getYun(self, gender, sect=1):
            return physical.getEightChar().getYun(gender, 1)

    result = CalendarEightChar(MixedLunar())
    result.setSect(2)
    return result
