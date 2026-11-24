import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { Pressable } from '@/components/Pressable';
import { TextField } from '@/components/TextField';
import { loginErrorText } from '@/data/loginError';
import { fonts, type Palette, radius, size, space, text } from '@/theme';

/** The demo (briefs 080, 081): the app with sample data in the browser, no account needed. */
const DEMO_URL = 'https://demo.kopiyka.englishplus.com.ua';

/** Brief 087: a new email asking for a real account, written already encoded. */
const ACCESS_REQUEST_URL = 'mailto:dmytro.kostylov@gmail.com?subject=Kopiyka%20access%20request';

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

        <View style={{ gap: space.lg }}>
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

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            // Named here because while busy its only child is a spinner.
            accessibilityLabel="Sign in"
            aria-busy={busy}
            // disabled, not aria-disabled: react-native-web's Pressable sets aria-disabled from disabled only.
            disabled={!ready}
            onPress={submit}
            style={[styles.button, !ready && styles.buttonDisabled]}
          >
            {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Link href={DEMO_URL} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Try it now" style={styles.demoLink}>
              <Text style={styles.demoLinkText}>Try it now</Text>
            </Pressable>
          </Link>
        </View>

        {/* Web only (brief 087): the store builds may not point to paying outside their own billing (Apple 3.1.1, 3.1.3;
            Google Play), and a price beside a contact link can read as that. */}
        {Platform.OS === 'web' ? (
          <View style={styles.access}>
            <Link href={ACCESS_REQUEST_URL} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Request access" style={styles.demoLink}>
                <Text style={styles.demoLinkText}>Request access</Text>
              </Pressable>
            </Link>
            <Text style={styles.price}>Full access: €5 a month</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: {
      flex: 1,
      padding: space.xxl,
      justifyContent: 'center',
      gap: space.xxxl,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
    },
    title: { ...text.display, color: colors.text },
    field: { gap: space.sm },
    label: { ...text.label, color: colors.muted },
    input: {
      ...text.input,
      fontFamily: fonts.bodyMedium,
      height: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: space.lg,
    },
    // The one-time code: big, spaced digits that the scale has no role for (one caller; brief 105 picks its face with
    // Inter).
    // eslint-disable-next-line no-restricted-syntax
    passwordInput: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 8, fontVariant: ['tabular-nums'] },
    error: { ...text.label, color: colors.over },
    button: {
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.4 },
    buttonText: { ...text.bodyStrong, color: colors.onAccent },
    // The Sign in button and the demo link right below it, as one group.
    actions: { gap: space.sm },
    // A 44pt touch target, as the conventions ask.
    demoLink: {
      minHeight: size.iconButton,
      minWidth: size.iconButton,
      paddingHorizontal: space.lg,
      alignSelf: 'center',
      justifyContent: 'center',
    },
    demoLinkText: { ...text.bodyStrong, color: colors.accent },
    // The access request and its price, as one group: no gap, so the price sits right under the link's 44pt box.
    access: { alignItems: 'center' },
    price: { ...text.label, color: colors.muted, textAlign: 'center' },
  });
