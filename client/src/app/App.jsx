import AppRouter from './router.jsx';
import SplashIntro from '../components/animations/SplashIntro.jsx';

/** Application shell. All routing lives in router.jsx. */
export default function App() {
  return (
    <>
      <AppRouter />
      <SplashIntro />
    </>
  );
}
