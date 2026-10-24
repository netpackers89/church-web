import logoUrl from '../../assets/mulu-wengel-logo.svg';
import './ChurchLoader.css';

export default function ChurchLoader({ message = 'Loading…', inline = false }) {
  return (
    <div className={`church-loader${inline ? ' is-inline' : ''}`} role="status" aria-live="polite">
      <span className="church-loader-mark" aria-hidden="true">
        <img src={logoUrl} alt="" />
      </span>
      <span className={inline ? 'church-loader-message' : 'sr-only'}>{message}</span>
    </div>
  );
}
