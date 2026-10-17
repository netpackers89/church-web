import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Heart,
} from 'lucide-react';

import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Brand from '../../components/ui/Brand.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getPostLoginPath } from '../../app/authNavigation.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next = {};

    if (!email.trim()) {
      next.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Password is required.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      const user = await login(email.trim(), password);

      if (!user) throw new Error('Signed in, but your account access could not be loaded. Please try again.');
      navigate(getPostLoginPath(user, from), { replace: true });
    } catch (error) {
      setPassword('');
      setFormError(
        error?.message || 'Sign in failed. Please check your credentials.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="modern-auth-page">
      <section className="modern-auth-shell">
        <aside className="modern-auth-visual">
          <div className="modern-visual-image" />

          <div className="modern-visual-overlay" />

          <div className="modern-visual-top">
            <Brand to="/" className="on-dark" subtitle="Church Community" />
            <span className="modern-visual-label">
              <span className="modern-live-dot" />
              A place to belong
            </span>
          </div>

          <div className="modern-visual-content">
            <span className="modern-eyebrow">
              FAITH · COMMUNITY · CONNECTION
            </span>

            <h1>
              Your faith journey.
              <br />
              <span>Connected.</span>
            </h1>

            <p>
              Stay close to your church family, discover upcoming gatherings,
              grow in the Word, and find your place in the community.
            </p>

            <div className="modern-verse-card">
              <div className="modern-verse-icon">
                <Heart size={19} />
              </div>

              <div>
                <p>
                  “Let us consider how we may spur one another on toward love
                  and good deeds.”
                </p>
                <span>HEBREWS 10:24</span>
              </div>
            </div>
          </div>

          <div className="modern-visual-footer">
            <ShieldCheck size={16} />
            A welcoming space for your faith and community
          </div>
        </aside>

        <section className="modern-auth-form-panel">
          <div className="modern-mobile-brand">
            <Brand to="/" subtitle="Church Community" />
          </div>

          <div className="modern-auth-form-inner">
            <div className="modern-form-heading">
              <span className="modern-form-kicker">WELCOME BACK</span>
              <h2>Good to see you.</h2>
              <p>Sign in to continue your journey with us.</p>
            </div>

            {formError && (
              <div className="modern-alert">
                <Alert variant="danger">{formError}</Alert>
              </div>
            )}

            <form className="modern-form" onSubmit={onSubmit} noValidate>
              <Input
                label="Email address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((previous) => ({
                    ...previous,
                    email: undefined,
                  }));
                }}
                error={errors.email}
                required
              />

              <div className="modern-password-field">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((previous) => ({
                      ...previous,
                      password: undefined,
                    }));
                  }}
                  error={errors.password}
                  required
                />

                <button
                  type="button"
                  className="modern-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="modern-form-options">
                <label className="modern-check-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Keep me signed in</span>
                </label>

                <Link to="/forgot-password" className="modern-text-link">
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                disabled={submitting}
                iconRight={!submitting ? <ArrowRight size={18} /> : undefined}
              >
                {submitting ? 'Signing you in...' : 'Sign in'}
              </Button>
            </form>

            <div className="modern-auth-divider">
              <span />
              <span>NEW TO OUR COMMUNITY?</span>
              <span />
            </div>

            <p className="modern-auth-switch">
              Create your account and stay connected.
              <Link to="/register"> Join the community</Link>
            </p>

            <Link to="/" className="modern-back-link">
              <ArrowRight size={15} className="modern-back-icon" />
              Back to website
            </Link>
          </div>

          <footer className="modern-auth-bottom">
            Made for faith, fellowship, and connection.
          </footer>
        </section>
      </section>
    </main>
  );
}