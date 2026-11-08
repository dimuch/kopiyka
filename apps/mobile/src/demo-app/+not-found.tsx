import { Redirect } from 'expo-router';

/** The demo has no Settings, Statistics, members or sign-in: any other path lands on Home. */
export default function NotFound() {
  return <Redirect href="/" />;
}
