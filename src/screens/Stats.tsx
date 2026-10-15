import React, { useState } from 'react';
import { View } from 'react-native';
import { LedgerEntry } from '../domain/model';
import { points } from '../domain/engine';
import { completion, streak, trend } from '../domain/stats';
import { dateKey } from '../domain/time';
import { locale } from '../i18n';
import { useApp } from '../state/AppProvider';
import { C, Card, Chip, Empty, Field, Icon, Label, Page, Row, Title } from '../ui/components';
function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function Stats() {
  const { data, t } = useApp(),
    [days, setDays] = useState(7),
    [kind, setKind] = useState<'all' | LedgerEntry['kind']>('all');
  const [query, setQuery] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(1);
  const today = dateKey(),
    bars = trend(data, days),
    max = Math.max(...bars.map((b) => Math.abs(b.delta)), 2);
  const dateError =
    (from !== '' && !validDate(from)) ||
    (to !== '' && !validDate(to)) ||
    (!!from && !!to && from > to);
  const entries = [...data.ledger]
    .reverse()
    .filter(
      (e) =>
        (kind === 'all' || e.kind === kind) &&
        e.name.toLowerCase().includes(query.toLowerCase()) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    );
  const format = (at: string) => new Date(at).toLocaleString(locale[data.settings.language]);
  return (
    <Page>
      <Title>{t('stats')}</Title>
      <Row>
        <View style={{ flex: 1 }}>
          <Card>
            <Icon name="flame-outline" color={C.gold} />
            <Label muted>{t('streak')}</Label>
            <Label style={{ fontSize: 30, fontWeight: '600' }}>
              {streak(data)} <Label muted>{t('days')}</Label>
            </Label>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card>
            <Icon name="pie-chart-outline" />
            <Label muted>{t('completion')}</Label>
            <Label style={{ fontSize: 30, fontWeight: '600' }}>{completion(data)}%</Label>
          </Card>
        </View>
      </Row>
      <Label muted style={{ fontSize: 12 }}>
        {t('completionHint')}
      </Label>
      <Card>
        <Title>{t('trend')}</Title>
        <Row>
          <Chip title={t('week')} selected={days === 7} onPress={() => setDays(7)} />
          <Chip title={t('month')} selected={days === 30} onPress={() => setDays(30)} />
        </Row>
        <View
          accessibilityLabel={`${t('trend')}: ${bars.map((b) => `${b.date}: ${points(b.delta)}`).join(', ')}`}
          style={{
            height: 180,
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: days === 7 ? 10 : 3,
            marginTop: 12,
          }}
        >
          {bars.map((b, i) => (
            <View
              key={b.date}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}
            >
              <View
                style={{
                  height: 70,
                  width: '100%',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                {days === 7 && (
                  <Label muted style={{ fontSize: 10 }}>
                    {b.delta > 0 ? '+' : ''}
                    {points(b.delta)}
                  </Label>
                )}
                <View
                  style={{
                    height: b.delta > 0 ? Math.max(3, (48 * b.delta) / max) : 0,
                    width: '65%',
                    backgroundColor: C.green,
                    borderTopLeftRadius: 5,
                    borderTopRightRadius: 5,
                  }}
                />
              </View>
              <View style={{ height: 1, backgroundColor: C.line, width: '100%' }} />
              <View style={{ height: 58, width: '100%', alignItems: 'center' }}>
                <View
                  style={{
                    height: b.delta < 0 ? Math.max(3, (48 * -b.delta) / max) : 0,
                    width: '65%',
                    backgroundColor: '#CC9580',
                    borderBottomLeftRadius: 5,
                    borderBottomRightRadius: 5,
                  }}
                />
              </View>
              <Label muted style={{ fontSize: 9 }}>
                {days === 7 || i % 5 === 0 ? b.date.slice(5) : ''}
              </Label>
            </View>
          ))}
        </View>
        <Label muted style={{ fontSize: 12 }}>
          {t('trendHint')}
        </Label>
      </Card>
      <Title>{t('details')}</Title>
      {!data.checkIns.some((c) => c.date === today) && <Label muted>{t('noCheckIns')}</Label>}
      {data.checkIns
        .filter((c) => c.date === today)
        .reverse()
        .map((c) => (
          <Card key={c.id}>
            <Row>
              <Icon
                name={c.kind === 'good' ? 'checkmark-circle-outline' : 'flame-outline'}
                color={c.kind === 'good' ? C.green : C.red}
              />
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '600' }}>
                  {c.name} · {t(c.fraction === 1 ? 'full' : 'half')}
                </Label>
                <Label muted style={{ fontSize: 12 }}>
                  {format(c.at)}
                </Label>
                {!!c.note && <Label style={{ fontSize: 13, marginTop: 7 }}>{c.note}</Label>}
              </View>
              <Label style={{ color: c.delta < 0 ? C.red : C.green }}>
                {c.delta > 0 ? '+' : ''}
                {points(c.delta)}
              </Label>
            </Row>
          </Card>
        ))}
      <Title>{t('ledger')}</Title>
      <Card>
        <Field
          label={t('search')}
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            setPage(1);
          }}
        />
        <Row>
          <View style={{ flex: 1 }}>
            <Field
              label={t('from')}
              value={from}
              placeholder="2026-10-01"
              onChangeText={(v) => {
                setFrom(v);
                setPage(1);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('to')}
              value={to}
              placeholder="2026-10-31"
              onChangeText={(v) => {
                setTo(v);
                setPage(1);
              }}
            />
          </View>
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {(['all', 'checkIn', 'redemption', 'weeklyReset'] as const).map((k) => (
            <Chip
              title={t(k)}
              selected={kind === k}
              key={k}
              onPress={() => {
                setKind(k);
                setPage(1);
              }}
            />
          ))}
        </View>
        {dateError && <Label style={{ color: C.red, fontSize: 12 }}>{t('dateError')}</Label>}
      </Card>
      {!dateError && entries.length === 0 && (
        <Empty title={t('noRecords')} icon="receipt-outline" />
      )}
      {!dateError &&
        entries.slice(0, page * 30).map((e) => (
          <Card key={e.id}>
            <Row>
              <View style={{ flex: 1, gap: 3 }}>
                <Label style={{ fontWeight: '600' }}>
                  {e.kind === 'weeklyReset' ? t('weeklyReset') : e.name}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  {format(e.at)} · {t(e.kind)}
                </Label>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label style={{ fontWeight: '600', color: e.delta < 0 ? C.red : C.green }}>
                  {e.delta > 0 ? '+' : ''}
                  {points(e.delta)}
                </Label>
                <Label muted style={{ fontSize: 11 }}>
                  {t('remaining')} {points(e.balance)}
                </Label>
              </View>
            </Row>
          </Card>
        ))}
      {!dateError && entries.length > page * 30 && (
        <Chip
          title={`${Math.min(page * 30, entries.length)} / ${entries.length} ↓`}
          selected={false}
          onPress={() => setPage(page + 1)}
        />
      )}
      <Title>{t('exemptionLogs')}</Title>
      {!data.exemptions.length && <Label muted>{t('noRecords')}</Label>}
      {[...data.exemptions].reverse().map((e) => (
        <Card key={e.id}>
          <Row>
            <Icon name="ticket-outline" color={C.gold} />
            <Label>{format(e.at)}</Label>
          </Row>
        </Card>
      ))}
    </Page>
  );
}
