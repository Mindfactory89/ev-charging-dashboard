import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";

class ErrorBoundaryContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("🚨 UI Crash:", err, info);
    this.setState({ info });
  }

  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      const stack = String(this.state.err?.stack || "");
      const comp = String(this.state.info?.componentStack || "");

      return (
        <div className="app">
          <div className="card glassStrong" style={{ padding: 16, border: "1px solid var(--color-danger)" }}>
            <div className="sectionKicker">{this.props.t("errorBoundary.kicker")}</div>
            <div className="sectionTitle" style={{ marginTop: 6 }}>
              {this.props.t("errorBoundary.title")}
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5 }}>
              <b>{this.props.t("errorBoundary.messageLabel")}</b> {msg}
              <div style={{ marginTop: 8, opacity: 0.8 }}>
                {this.props.t("errorBoundary.help")}
              </div>
            </div>

            <pre
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                overflow: "auto",
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-border)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                whiteSpace: "pre-wrap",
              }}
            >
              {stack || this.props.t("errorBoundary.noStack")}
              {comp ? `\n\n${this.props.t("errorBoundary.componentStack")}\n${comp}` : ""}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary(props) {
  const { t } = useI18n();
  return <ErrorBoundaryContainer {...props} t={t} />;
}
