import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/apiError';
import { useColors, useThemedStyles } from '@/appearance/AppearanceContext';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Pressable } from '@/components/Pressable';
import { Text } from '@/components/Text';
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
        <Text variant="display">Kopiyka</Text>

        <View style={{ gap: space.lg }}>
          <View style={styles.field}>
            <Text variant="label" color="muted">
              Username
            </Text>
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
            <Text variant="label" color="muted">
              Password
            </Text>
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
              placeholderTextColor={colors.muted}
            />
          </View>
          {error ? (
            <Text accessibilityRole="alert" variant="label" color="danger">
              {error}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            size="large"
            label="Sign in"
            busy={busy}
            disabled={!ready}
            onPress={submit}
            style={[styles.signIn, !ready && styles.signInOff]}
          />
          <Link href={DEMO_URL} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel="Try it now" style={styles.demoLink}>
              <Text variant="bodyStrong" color="accent">
                Try it now
              </Text>
            </Pressable>
          </Link>
        </View>

        {/* Web only (brief 087): the store builds may not point to paying outside their own billing (Apple 3.1.1, 3.1.3;
            Google Play), and a price beside a contact link can read as that. */}
        {Platform.OS === 'web' ? (
          <View style={styles.access}>
            <Link href={ACCESS_REQUEST_URL} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Request access" style={styles.demoLink}>
                <Text variant="bodyStrong" color="accent">
                  Request access
                </Text>
              </Pressable>
            </Link>
            <Text variant="label" color="muted" style={styles.price}>
              Full access: €5 a month
            </Text>
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
    field: { gap: space.sm },
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
    // The one-time code: big, spaced digits that the scale has no role for (one caller; brief 105b picks its face with
    // Inter).
    // eslint-disable-next-line no-restricted-syntax
    passwordInput: { fontFamily: fonts.display, fontSize: 26, letterSpacing: 8, fontVariant: ['tabular-nums'] },
    // One-offs until brief 105d: the only large pill, and dimmer than other buttons while it can't be pressed.
    signIn: { borderRadius: radius.pill },
    signInOff: { opacity: 0.4 },
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
    // The access request and its price, as one group: no gap, so the price sits right under the link's 44pt box.
    access: { alignItems: 'center' },
    price: { textAlign: 'center' },
  });
