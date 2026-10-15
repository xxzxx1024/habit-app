import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from './src/state/AppProvider';
import { C, Icon, IconName } from './src/ui/components';
import { Home } from './src/screens/Home';
import { Habits } from './src/screens/Habits';
import { Shop } from './src/screens/Shop';
import { Stats } from './src/screens/Stats';
import { Settings } from './src/screens/Settings';
const tabs = [
  { key: 'home', icon: 'sunny-outline', screen: Home },
  { key: 'habits', icon: 'leaf-outline', screen: Habits },
  { key: 'shop', icon: 'gift-outline', screen: Shop },
  { key: 'stats', icon: 'bar-chart-outline', screen: Stats },
  { key: 'settings', icon: 'options-outline', screen: Settings },
] as const;
function Shell() {
  const { t, syncStatus } = useApp(),
    [active, setActive] = useState(0),
    Screen = tabs[active]!.screen;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Icon name="leaf" size={22} />
          <Text style={{ fontSize: 20, fontWeight: '600', color: C.ink }}>{t('app')}</Text>
        </View>
        <Icon
          name={syncStatus === 'synced' ? 'cloud-done-outline' : 'ellipse-outline'}
          size={17}
          color={C.muted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Screen />
      </View>
      <SafeAreaView edges={['bottom']} style={s.nav}>
        <View style={{ flexDirection: 'row', maxWidth: 760, alignSelf: 'center', width: '100%' }}>
          {tabs.map((tab, i) => (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={t(tab.key)}
              accessibilityState={{ selected: active === i }}
              onPress={() => setActive(i)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 8,
                gap: 4,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 17,
                  backgroundColor: active === i ? C.mint : 'transparent',
                  borderRadius: 14,
                }}
              >
                <Icon
                  name={tab.icon as IconName}
                  size={22}
                  color={active === i ? C.green : C.muted}
                />
              </View>
              <Text
                style={{
                  fontSize: 10,
                  color: active === i ? C.green : C.muted,
                  fontWeight: active === i ? '600' : '400',
                }}
              >
                {t(tab.key)}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  header: {
    height: 62,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  nav: { backgroundColor: '#FFFEFA', borderTopWidth: 1, borderColor: C.line },
});
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
