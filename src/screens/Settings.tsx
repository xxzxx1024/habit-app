import React, { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { Language, RuleError } from '../domain/model';
import { points, resetProgress, updateSettings } from '../domain/engine';
import { locale, languageNames } from '../i18n';
import { useApp } from '../state/AppProvider';
import { shareCSV } from '../services/export';
import { Button, C, Card, Chip, Field, Icon, Label, Page, Row, Title, ask } from '../ui/components';
import { useTask } from '../ui/useTask';
export function Settings() {
  const { data, mutate, t, autoSync, syncStatus, sync, enableSync, conflict } = useApp(),
    { run, pending } = useTask();
  const [cap, setCap] = useState(String(points(data.settings.dailyCap))),
    [floor, setFloor] = useState(String(points(data.settings.floor)));
  const [weekly, setWeekly] = useState(data.settings.weeklyReset);
  useEffect(() => {
    setCap(String(points(data.settings.dailyCap)));
    setFloor(String(points(data.settings.floor)));
    setWeekly(data.settings.weeklyReset);
  }, [data.settings]);
  return (
    <Page>
      <Title>{t('settings')}</Title>
      <Card>
        <Row>
          <Icon name="language-outline" />
          <Label style={{ fontWeight: '600' }}>{t('language')}</Label>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(languageNames) as Language[]).map((l) => (
            <Chip
              key={l}
              title={languageNames[l]}
              selected={data.settings.language === l}
              onPress={() =>
                void run(() => mutate((s) => updateSettings(s, { ...s.settings, language: l })))
              }
            />
          ))}
        </View>
      </Card>
      <Card>
        <Title>{t('rules')}</Title>
        <Field label={t('cap')} value={cap} onChangeText={setCap} keyboardType="decimal-pad" />
        <Field
          label={t('floor')}
          value={floor}
          onChangeText={setFloor}
          keyboardType="numbers-and-punctuation"
        />
        <Row>
          <Label style={{ flex: 1 }}>{t('resetWeekly')}</Label>
          <Switch
            accessibilityLabel={t('resetWeekly')}
            value={weekly}
            onValueChange={setWeekly}
            trackColor={{ true: C.green }}
          />
        </Row>
        <Label muted style={{ fontSize: 12 }}>
          {t('weeklyHint')}
        </Label>
        <Button
          title={t('save')}
          disabled={pending}
          onPress={() =>
            void run(async () => {
              if (cap.trim() === '' || floor.trim() === '') throw new RuleError('invalid');
              await mutate((s) =>
                updateSettings(s, {
                  ...s.settings,
                  dailyCap: Number(cap) * 2,
                  floor: Number(floor) * 2,
                  weeklyReset: weekly,
                }),
              );
            })
          }
        />
        <Label muted style={{ fontSize: 12 }}>
          {t('ruleHint')}
        </Label>
      </Card>
      <Card>
        <Row>
          <Icon name="cloud-outline" />
          <Label style={{ fontWeight: '600', flex: 1 }}>{t('cloud')}</Label>
        </Row>
        <Row>
          <Label style={{ flex: 1 }}>{t('syncOn')}</Label>
          <Switch
            accessibilityLabel={t('syncOn')}
            disabled={pending}
            value={autoSync}
            onValueChange={(v) =>
              void run(async () => {
                await enableSync(v);
                if (v) await sync();
              })
            }
            trackColor={{ true: C.green }}
          />
        </Row>
        <Label muted style={{ fontSize: 12 }}>
          {t('cloudHint')}
        </Label>
        <Label
          style={{
            fontSize: 13,
            color:
              syncStatus === 'syncError' || syncStatus === 'cloudUnavailable' ? C.red : C.green,
          }}
        >
          {t(syncStatus)}
        </Label>
        <Button
          title={t('sync')}
          icon="sync-outline"
          secondary
          disabled={pending || syncStatus === 'syncing'}
          onPress={() => void run(() => sync())}
        />
        {!!conflict && (
          <View style={{ backgroundColor: C.peach, borderRadius: 16, padding: 16, gap: 12 }}>
            <Label style={{ fontSize: 13 }}>{t('conflict')}</Label>
            {conflict[0] && (
              <Label muted style={{ fontSize: 12 }}>
                iCloud:{' '}
                {new Date(conflict[0].document.updatedAt).toLocaleString(
                  locale[data.settings.language],
                )}{' '}
                · {points(conflict[0].document.data.balance)} {t('points')}
              </Label>
            )}
            <Button
              title={t('keepLocal')}
              disabled={pending}
              onPress={() =>
                void run(async () => {
                  if (await ask(t('cloud'), t('conflict'), t('keepLocal'), t('cancel')))
                    await sync('local');
                })
              }
            />
            <Button
              title={t('keepCloud')}
              secondary
              disabled={pending}
              onPress={() =>
                void run(async () => {
                  if (await ask(t('cloud'), t('conflict'), t('keepCloud'), t('cancel')))
                    await sync('cloud');
                })
              }
            />
          </View>
        )}
      </Card>
      <Card>
        <Title>{t('data')}</Title>
        <Button
          title={t('export')}
          icon="download-outline"
          secondary
          disabled={pending}
          onPress={() => void run(() => shareCSV(data))}
        />
        <Button
          title={t('reset')}
          icon="refresh-outline"
          danger
          secondary
          disabled={pending}
          onPress={() =>
            void run(async () => {
              if (await ask(t('reset'), t('resetConfirm'), t('confirm'), t('cancel')))
                await mutate((s) => resetProgress(s));
            })
          }
        />
        <Label muted style={{ fontSize: 12 }}>
          {t('privacy')}
        </Label>
      </Card>
      <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
        <Icon name="leaf-outline" size={26} />
        <Label muted style={{ fontSize: 12 }}>
          {t('about')}
        </Label>
        <Label muted style={{ fontSize: 11 }}>
          {t('version')}
        </Label>
      </View>
    </Page>
  );
}
