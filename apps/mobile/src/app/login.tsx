import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { loginErrorText } from '@/data/loginError';
import { fonts, type Palette } from '@/theme';

export default function Login() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = username.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(loginErrorText(err instanceof ApiError ? err.code : null));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.body}>
        <Text style={styles.title}>Kopiyka</Text>

        <View style={{ gap: 14 }}>
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextField
              accessibilityLabel="Username"
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
            <Text style={styles.label}>Password</Text>
            <TextField
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={submit}
              style={[styles.input, styles.passwordInput]}
              placeholder="••••••"
              placeholderTextColor={colors.fainter}
            />
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
      gap: 32,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    title: { fontFamily: fonts.display, fontSize: 40, color: colors.text, letterSpacing: -0.8 },
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
    passwordInput: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 8, fontVariant: ['tabular-nums'] },
    error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.over },
    button: {
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onAccent },
  });
