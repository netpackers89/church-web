import ChurchLoader from '../animations/ChurchLoader.jsx';

/** Full-screen loading indicator used while restoring a session or bootstrapping. */
export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <ChurchLoader message={message} />
  );
}
