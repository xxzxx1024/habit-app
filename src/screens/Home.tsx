import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  cardAvailable,
  checkIn,
  earnedToday,
  isExempt,
  isScheduled,
  points,
  setNote,
  useCard,
} from '../domain/engine';
import { CheckIn } from '../domain/model';
import { dateKey } from '../domain/time';
import { completion, streak } from '../domain/stats';
import { useApp } from '../state/AppProvider';
import { locale } from '../i18n';
import {
  Button,
  C,
  Card,
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
export function Home() {
  const { data, mutate, t } = useApp(),
    { run, pending } = useTask(),
    today = dateKey();
  const [logs, setLogs] = useState<string | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [note, setNoteText] = useState('');
  const habits = data.habits.filter((h) => isScheduled(h, today));
  const checkIns = data.checkIns.filter((c) => c.date === today && c.habitId === logs);
  const openNote = (c: CheckIn) => {
    setSelected(c.id);
    setNoteText(c.note);
  };
  return (
    <Page>
      <View style={{ gap: 6, marginTop: 4 }}>
        <Label muted style={{ fontSize: 12, letterSpacing: 1 }}>
          {new Intl.DateTimeFormat(locale[data.settings.language], {
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }).format(new Date())}
        </Label>
        <Text style={{ fontSize: 29, color: C.ink, fontWeight: '600' }}>{t('tagline')}</Text>
      </View>
      <View
        style={{
          backgroundColor: C.green,
          borderRadius: 28,
          padding: 25,
          overflow: 'hidden',
          gap: 12,
        }}
      >
        <View
          style={{
            position: 'absolute',
            right: -42,
            top: -32,
            width: 180,
            height: 180,
            borderRadius: 90,
            borderWidth: 25,
            borderColor: 'rgba(255,255,255,0.045)',
          }}
        />
        <Row>
          <Icon name="sparkles-outline" color="#D8E5CB" size={18} />
          <Label style={{ color: '#D8E5CB', fontSize: 13 }}>{t('balance')}</Label>
        </Row>
        <Row>
          <Text style={{ fontSize: 62, fontWeight: '300', letterSpacing: -2, color: '#FFFDF2' }}>
            {points(data.balance)}
          </Text>
          <Label style={{ color: '#D8E5CB', marginTop: 26 }}>{t('points')}</Label>
        </Row>
        <View style={{ height: 1, backgroundColor: '#53715E', marginVertical: 3 }} />
        <Row>
          <Label style={{ color: '#D8E5CB', fontSize: 13, flex: 1 }}>{t('dailyEarned')}</Label>
          <Label style={{ color: 'white', fontWeight: '600' }}>
            +{points(earnedToday(data, today))} / {points(data.settings.dailyCap)}
          </Label>
        </Row>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: '#53715E' }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#DBE9C8',
              width: `${data.settings.dailyCap ? Math.min(100, (100 * earnedToday(data, today)) / data.settings.dailyCap) : 0}%`,
            }}
          />
        </View>
      </View>
      <Row>
        <View style={{ flex: 1 }}>
          <Card>
            <Row>
              <Icon name="flame-outline" color={C.gold} />
              <Label muted style={{ fontSize: 12, flex: 1 }}>
                {t('streak')}
              </Label>
            </Row>
            <Label style={{ fontSize: 26, fontWeight: '600' }}>
              {streak(data)}{' '}
              <Label muted style={{ fontSize: 12 }}>
                {t('days')}
              </Label>
            </Label>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Row>
              <Icon name="checkmark-circle-outline" />
              <Label muted style={{ fontSize: 12, flex: 1 }}>
                {t('completion')}
              </Label>
            </Row>
            <Label style={{ fontSize: 26, fontWeight: '600' }}>
              {completion(data)}
              <Label muted style={{ fontSize: 14 }}>
                {' '}
                %
              </Label>
            </Label>
          </Card>
        </View>
      </Row>
      <Title
        aside={
          <Label muted style={{ fontSize: 12 }}>
            {habits.length} · {t('today')}
          </Label>
        }
      >
        {t('habits')}
      </Title>
      <Label muted style={{ fontSize: 12, marginTop: -10 }}>
        {t('noteHelp')}
      </Label>
      {!habits.length && (
        <Empty
          title={t(data.habits.length ? 'emptyScheduled' : 'emptyHabits')}
          hint={t('emptyHabitsHint')}
        />
      )}
      {habits.map((h) => {
        const count = data.checkIns.filter((c) => c.habitId === h.id && c.date === today).length;
        return (
          <Card key={h.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${h.name} ${t('note')}`}
              onPress={() => {
                if (count) {
                  setLogs(h.id);
                  setSelected(null);
                } else void run(() => mutate((s) => checkIn(s, h.id, 1)));
              }}
            >
              <Row>
                <View
                  style={{
                    height: 44,
                    width: 44,
                    borderRadius: 15,
                    backgroundColor: h.kind === 'good' ? C.mint : C.peach,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={
                      count ? 'checkmark' : h.kind === 'good' ? 'leaf-outline' : 'flame-outline'
                    }
                    color={h.kind === 'good' ? C.green : C.red}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Label style={{ fontSize: 17, fontWeight: '600' }}>{h.name}</Label>
                  <Label muted style={{ fontSize: 12 }}>
                    {h.kind === 'good' ? '+' : '−'}
                    {points(h.points)} {t('points')} · {count}/{h.limit}
                  </Label>
                </View>
                {count > 0 && <Icon name="create-outline" size={18} color={C.muted} />}
              </Row>
            </Pressable>
            <Row>
              {h.halfEnabled && (
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('half')}
                    secondary
                    small
                    disabled={pending || count >= h.limit}
                    onPress={() => void run(() => mutate((s) => checkIn(s, h.id, 0.5)))}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Button
                  title={t(h.kind === 'good' ? 'complete' : 'occurred')}
                  small
                  disabled={pending || count >= h.limit}
                  icon="add"
                  onPress={() => void run(() => mutate((s) => checkIn(s, h.id, 1)))}
                />
              </View>
            </Row>
          </Card>
        );
      })}
      <Card tint={C.peach}>
        <Row>
          <Icon name="ticket-outline" color={C.gold} />
          <View style={{ flex: 1 }}>
            <Label style={{ fontWeight: '600' }}>{t('card')}</Label>
            <Label muted style={{ fontSize: 12 }}>
              {t(cardAvailable(data) ? 'cardReady' : 'cardUsed')}
            </Label>
          </View>
        </Row>
        <Label style={{ fontSize: 12, lineHeight: 19 }}>{t('cardHint')}</Label>
        {isExempt(data, today) ? (
          <Label style={{ fontWeight: '600' }}>{t('cardActive')}</Label>
        ) : (
          <Button
            title={t('useCard')}
            secondary
            disabled={pending || !cardAvailable(data)}
            onPress={() =>
              void run(async () => {
                if (await ask(t('card'), t('cardConfirm'), t('confirm'), t('cancel')))
                  await mutate((s) => useCard(s));
              })
            }
          />
        )}
      </Card>
      <Sheet
        visible={logs !== null}
        title={t('note')}
        closeLabel={t('close')}
        onClose={() => setLogs(null)}
      >
        {checkIns.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => openNote(c)}
            style={{ marginBottom: 12 }}
          >
            <Card tint={selected === c.id ? C.mint : C.paper}>
              <Row>
                <Label style={{ flex: 1 }}>
                  {new Date(c.at).toLocaleTimeString(locale[data.settings.language], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {t(c.fraction === 1 ? 'full' : 'half')}
                </Label>
                <Label>
                  {c.delta > 0 ? '+' : ''}
                  {points(c.delta)}
                </Label>
              </Row>
              <Label muted>{c.note || t('noteHint')}</Label>
            </Card>
          </Pressable>
        ))}
        {selected && (
          <>
            <Field
              label={t('note')}
              multiline
              value={note}
              onChangeText={setNoteText}
              maxLength={2000}
            />
            <Button
              title={t('save')}
              disabled={pending}
              onPress={() =>
                void run(async () => {
                  await mutate((s) => setNote(s, selected, note));
                  setSelected(null);
                })
              }
            />
          </>
        )}
      </Sheet>
    </Page>
  );
}
