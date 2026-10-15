import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
export const C = {
  bg: '#F6F5F0',
  paper: '#FFFFFF',
  ink: '#243D32',
  muted: '#778179',
  green: '#315B47',
  mint: '#E6EDE3',
  line: '#E6E7DF',
  peach: '#F5E5D8',
  red: '#AD5646',
  gold: '#B98940',
};
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({
  name,
  size = 22,
  color = C.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function Label({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[{ color: muted ? C.muted : C.ink, fontSize: 15, lineHeight: 22 }, style]}>
      {children}
    </Text>
  );
}
export function Title({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {aside}
    </View>
  );
}
export function Card({ children, tint = C.paper }: { children: React.ReactNode; tint?: string }) {
  return <View style={[styles.card, { backgroundColor: tint }]}>{children}</View>;
}
export function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  small = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  small?: boolean;
  icon?: IconName;
}) {
  const color = secondary ? (danger ? C.red : C.green) : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? C.mint : danger ? C.red : C.green,
          paddingVertical: small ? 10 : 14,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        danger && secondary && { backgroundColor: '#F8EAE5' },
      ]}
    >
      {icon && <Icon name={icon} size={17} color={color} />}
      <Text
        style={{
          color,
          fontSize: small ? 12 : 14,
          fontWeight: '600',
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: C.green, borderColor: C.green }]}
    >
      <Text
        style={{
          fontSize: 13,
          color: selected ? 'white' : C.muted,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7, marginBottom: 16 }}>
      <Label style={{ fontSize: 13, fontWeight: '600' }}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9BA49E"
        {...props}
        style={[
          styles.input,
          props.multiline && { height: 112, textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
      {children}
    </ScrollView>
  );
}
export function Empty({
  title,
  hint,
  icon = 'leaf-outline',
}: {
  title: string;
  hint?: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} />
      </View>
      <Label style={{ fontSize: 17, fontWeight: '600', textAlign: 'center' }}>{title}</Label>
      {hint && (
        <Label muted style={{ textAlign: 'center', maxWidth: 290, marginTop: 8 }}>
          {hint}
        </Label>
      )}
    </View>
  );
}
export function Sheet({
  title,
  visible,
  onClose,
  closeLabel,
  children,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ padding: 22, borderBottomWidth: 1, borderColor: C.line }}>
            <Row>
              <Text style={{ flex: 1, fontSize: 23, fontWeight: '600', color: C.ink }}>
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
                style={{ padding: 8 }}
              >
                <Icon name="close" />
              </Pressable>
            </Row>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 24,
              paddingBottom: 60,
              width: '100%',
              maxWidth: 600,
              alignSelf: 'center',
            }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export async function ask(
  title: string,
  message: string,
  confirm: string,
  cancel: string,
): Promise<boolean> {
  if (Platform.OS === 'web') return window.confirm(`${title}\n\n${message}`);
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirm, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
export function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n${message}`);
  else Alert.alert(title, message);
}
export const styles = StyleSheet.create({
  page: {
    padding: 22,
    paddingBottom: 36,
    gap: 18,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(36,61,50,0.05)',
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 19, fontWeight: '600', color: C.ink, flexShrink: 1 },
  button: {
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.paper,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 13,
    padding: 14,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.paper,
    minHeight: 48,
  },
  empty: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 12 },
  emptyIcon: {
    backgroundColor: C.mint,
    width: 66,
    height: 66,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
});
