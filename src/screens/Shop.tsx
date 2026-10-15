import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Reward } from '../domain/model';
import { id, points, redeem, saveReward } from '../domain/engine';
import { locale } from '../i18n';
import { useApp } from '../state/AppProvider';
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
function RewardEditor({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const { mutate, t } = useApp(),
    { run, pending } = useTask();
  const [name, setName] = useState(reward?.name ?? ''),
    [cost, setCost] = useState(String(points(reward?.cost ?? 40)));
  return (
    <Sheet title={t(reward ? 'edit' : 'add')} visible closeLabel={t('close')} onClose={onClose}>
      <Field label={t('name')} value={name} onChangeText={setName} maxLength={80} />
      <Field
        label={t('rewardCost')}
        value={cost}
        onChangeText={setCost}
        keyboardType="decimal-pad"
      />
      <Button
        title={t('save')}
        disabled={pending}
        onPress={() =>
          void run(async () => {
            await mutate((s) =>
              saveReward(s, { id: reward?.id ?? id(), name, cost: Number(cost) * 2 }),
            );
            onClose();
          })
        }
      />
    </Sheet>
  );
}
export function Shop() {
  const { data, mutate, t } = useApp(),
    { run, pending } = useTask();
  const [editing, setEditing] = useState<Reward | null | undefined>(undefined);
  return (
    <Page>
      <Card tint={C.mint}>
        <Row>
          <Icon name="gift-outline" size={30} />
          <View style={{ flex: 1, gap: 4 }}>
            <Label muted style={{ fontSize: 12 }}>
              {t('balance')}
            </Label>
            <Label style={{ fontSize: 26, fontWeight: '600' }}>
              {points(data.balance)} <Label muted>{t('points')}</Label>
            </Label>
          </View>
        </Row>
      </Card>
      <Title aside={<Button title={t('add')} small icon="add" onPress={() => setEditing(null)} />}>
        {t('shop')}
      </Title>
      {!data.rewards.length && (
        <Empty title={t('emptyRewards')} hint={t('emptyRewardsHint')} icon="gift-outline" />
      )}
      {data.rewards.map((r, i) => (
        <Card key={r.id}>
          <Row>
            <View
              style={{ padding: 16, backgroundColor: i % 2 ? C.peach : C.mint, borderRadius: 18 }}
            >
              <Icon name={i % 2 ? 'cafe-outline' : 'gift-outline'} size={28} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Label style={{ fontSize: 18, fontWeight: '600' }}>{r.name}</Label>
              <Label style={{ color: C.gold, fontWeight: '600' }}>
                {points(r.cost)} {t('points')}
              </Label>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('edit')} ${r.name}`}
              style={{ padding: 10 }}
              onPress={() => setEditing(r)}
            >
              <Icon name="create-outline" size={20} />
            </Pressable>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                title={data.balance >= r.cost ? t('redeem') : t('insufficient')}
                icon="sparkles-outline"
                disabled={pending || data.balance < r.cost}
                onPress={() =>
                  void run(async () => {
                    if (await ask(r.name, t('redeemConfirm'), t('redeem'), t('cancel')))
                      await mutate((s) => redeem(s, r.id));
                  })
                }
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('deleteReward')} ${r.name}`}
              disabled={pending}
              style={{ padding: 12 }}
              onPress={() =>
                void run(async () => {
                  if (await ask(t('delete'), t('deleteConfirm'), t('delete'), t('cancel')))
                    await mutate((s) => ({
                      ...s,
                      rewards: s.rewards.filter((x) => x.id !== r.id),
                    }));
                })
              }
            >
              <Icon name="trash-outline" size={18} color={C.red} />
            </Pressable>
          </Row>
        </Card>
      ))}
      <Title>{t('redemptionHistory')}</Title>
      {!data.redemptions.length && <Label muted>{t('noRecords')}</Label>}
      {[...data.redemptions].reverse().map((r) => (
        <Card key={r.id}>
          <Row>
            <View style={{ flex: 1 }}>
              <Label style={{ fontWeight: '600' }}>{r.name}</Label>
              <Label muted style={{ fontSize: 12 }}>
                {new Date(r.at).toLocaleString(locale[data.settings.language])}
              </Label>
            </View>
            <Label style={{ color: C.red }}>−{points(r.cost)}</Label>
          </Row>
        </Card>
      ))}
      {editing !== undefined && (
        <RewardEditor reward={editing} onClose={() => setEditing(undefined)} />
      )}
    </Page>
  );
}
