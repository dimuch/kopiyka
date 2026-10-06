import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors, fonts } from '@/theme';

function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_credentials') return 'Wrong username or code.';
    if (err.code === 'blocked') return 'Too many wrong codes. Sign-in is blocked for 24 hours.';
    if (err.code === 'invalid_request') return 'Enter your username and the 6-digit code.';
  }
  return 'Can’t reach the server. Check your connection and try again.';
}

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = username.trim().length > 0 && /^\d{6}$/.test(code) && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), code);
    } catch (err) {
      setError(errorText(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Kopiyka</Text>
          <Text style={styles.subtitle}>Sign in with your username and the code from Google Authenticator.</Text>
        </View>

        <View style={{ gap: 14 }}>
          <View style={styles.field}>
            <Text nativeID="username-label" style={styles.label}>Username</Text>
            <TextInput
              accessibilityLabelledBy="username-label"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.field}>
            <Text nativeID="code-label" style={styles.label}>6-digit code</Text>
            <TextInput
              accessibilityLabelledBy="code-label"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={6}
              onSubmitEditing={submit}
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor="#4A505A"
            />
          </View>
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          onPress={submit}
          style={[styles.button, !ready && styles.buttonDisabled]}
        >
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: 24, justifyContent: 'center', gap: 32, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 40, color: colors.text, letterSpacing: -0.8 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 16,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
  },
  codeInput: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.over },
  button: { height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
});
