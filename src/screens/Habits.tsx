import React, { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Habit, Cycle } from '../domain/model';
import { dateKey } from '../domain/time';
import { id, points, saveHabit } from '../domain/engine';
import { useApp } from '../state/AppProvider';
import { refreshReminders } from '../services/notifications';
import { weekdayNames } from '../i18n';
import {
  Button,
  C,
  Card,
  Chip,
  Empty,
  Field,
  Icon,
  Label,
  Page,
  Row,
  Sheet,
  Title,
  ask,
} from '../ui/components';
import { useTask } from '../ui/useTask';

function HabitEditor({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const { data, mutate, t } = useApp(),
    { run, pending } = useTask();
  const [name, setName] = useState(habit?.name ?? ''),
    [kind, setKind] = useState(habit?.kind ?? 'good');
  const [score, setScore] = useState(String(points(habit?.points ?? 10))),
    [limit, setLimit] = useState(String(habit?.limit ?? 1));
  const [mode, setMode] = useState<Cycle['mode']>(habit?.cycle.mode ?? 'daily');
  const [days, setDays] = useState(
    habit?.cycle.mode === 'weekdays' ? habit.cycle.days : [1, 2, 3, 4, 5],
  );
  const [every, setEvery] = useState(
    String(habit?.cycle.mode === 'interval' ? habit.cycle.every : 2),
  );
  const [half, setHalf] = useState(habit?.halfEnabled ?? false),
    [reminder, setReminder] = useState(!!habit?.reminder),
    [time, setTime] = useState(habit?.reminder ?? '09:00');
  const save = () =>
    run(async () => {
      const cycle: Cycle =
        mode === 'daily'
          ? { mode }
          : mode === 'weekdays'
            ? { mode, days }
            : {
                mode,
                every: Number(every),
                anchor: habit?.cycle.mode === 'interval' ? habit.cycle.anchor : dateKey(),
              };
      const h: Habit = {
        id: habit?.id ?? id(),
        createdOn: habit?.createdOn ?? dateKey(),
        name,
        kind,
        points: Number(score) * 2,
        limit: Number(limit),
        cycle,
        halfEnabled: half,
        reminder: reminder ? time : null,
      };
      let next = data;
      await mutate((s) => {
        next = saveHabit(s, h);
        return next;
      });
      // Ask for notification permission only after an explicit reminder choice.
      // 习惯已经成功落盘：通知权限被拒绝时也必须退出表单，避免用户再次
      // 点击保存而重复创建模板。错误文案明确说明习惯已保存。
      try {
        if (reminder) await refreshReminders(next, true);
      } catch (error) {
        throw new Error(
          error instanceof Error && error.message === 'notificationDenied'
            ? 'notificationDenied'
            : 'notificationError',
        );
      } finally {
        onClose();
      }
    });
  return (
    <Sheet title={t(habit ? 'edit' : 'add')} visible onClose={onClose} closeLabel={t('close')}>
      <Field label={t('name')} value={name} onChangeText={setName} maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {(['good', 'bad'] as const).map((k) => (
          <Chip key={k} title={t(k)} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
      <Field label={t('perTime')} value={score} onChangeText={setScore} keyboardType="number-pad" />
      <Field label={t('limit')} value={limit} onChangeText={setLimit} keyboardType="number-pad" />
      <Label style={{ fontWeight: '600', marginBottom: 10 }}>{t('cycle')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {(['daily', 'weekdays', 'interval'] as const).map((m) => (
          <Chip key={m} title={t(m)} selected={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      {mode === 'weekdays' && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {weekdayNames(data.settings.language).map((label, d) => (
            <Chip
              key={d}
              title={label}
              selected={days.includes(d)}
              onPress={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
            />
          ))}
        </View>
      )}
      {mode === 'interval' && (
        <Field label={t('every')} value={every} onChangeText={setEvery} keyboardType="number-pad" />
      )}
      <Row>
        <Label style={{ flex: 1 }}>{t('halfEnabled')}</Label>
        <Switch
          accessibilityLabel={t('halfEnabled')}
          value={half}
          onValueChange={setHalf}
          trackColor={{ true: C.green }}
        />
      </Row>
      <View style={{ height: 18 }} />
      <Row>
        <Label style={{ flex: 1 }}>{t('reminder')}</Label>
        <Switch
          accessibilityLabel={t('reminder')}
          value={reminder}
          onValueChange={setReminder}
          trackColor={{ true: C.green }}
        />
      </Row>
      {reminder && (
        <View style={{ marginTop: 16 }}>
          <Field
            label={t('reminderTime')}
            value={time}
            onChangeText={setTime}
            placeholder="09:00"
          />
          <Label muted style={{ fontSize: 12 }}>
            {t('reminderHint')}
          </Label>
        </View>
      )}
      <View style={{ height: 24 }} />
      <Button title={t('save')} onPress={() => void save()} disabled={pending} />
    </Sheet>
  );
}
export function Habits() {
  const { data, mutate, t } = useApp(),
    { run, pending } = useTask();
  const [editing, setEditing] = useState<Habit | null | undefined>(undefined),
    [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
  return (
    <Page>
      <Title aside={<Button title={t('add')} icon="add" small onPress={() => setEditing(null)} />}>
        {t('habits')}
      </Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'good', 'bad'] as const).map((k) => (
          <Chip key={k} title={t(k)} selected={filter === k} onPress={() => setFilter(k)} />
        ))}
      </View>
      {!data.habits.length && <Empty title={t('emptyHabits')} hint={t('emptyHabitsHint')} />}
      {data.habits
        .filter((h) => filter === 'all' || h.kind === filter)
        .map((h) => (
          <Card key={h.id}>
            <Row>
              <View
                style={{
                  padding: 12,
                  backgroundColor: h.kind === 'good' ? C.mint : C.peach,
                  borderRadius: 14,
                }}
              >
                <Icon
                  name={h.kind === 'good' ? 'leaf-outline' : 'flame-outline'}
                  color={h.kind === 'good' ? C.green : C.red}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Label style={{ fontWeight: '600', fontSize: 17 }}>{h.name}</Label>
                <Label muted style={{ fontSize: 12 }}>
                  {t(h.kind)} · {h.kind === 'good' ? '+' : '−'}
                  {points(h.points)} · {h.limit}/{t('days')} · {t(h.cycle.mode)}
                </Label>
                {h.reminder && (
                  <Label muted style={{ fontSize: 12 }}>
                    ◷ {h.reminder}
                  </Label>
                )}
              </View>
            </Row>
            <Row>
              <View style={{ flex: 1 }}>
                <Button title={t('edit')} secondary small onPress={() => setEditing(h)} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('delete')} ${h.name}`}
                disabled={pending}
                style={{ padding: 12 }}
                onPress={() =>
                  void run(async () => {
                    if (await ask(t('delete'), t('deleteConfirm'), t('delete'), t('cancel')))
                      await mutate((s) => ({
                        ...s,
                        habits: s.habits.filter((x) => x.id !== h.id),
                      }));
                  })
                }
              >
                <Icon name="trash-outline" color={C.red} size={19} />
              </Pressable>
            </Row>
          </Card>
        ))}
      {editing !== undefined && (
        <HabitEditor habit={editing} onClose={() => setEditing(undefined)} />
      )}
    </Page>
  );
}
