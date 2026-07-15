import React from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { reloadCurrentPage } from "../platform/runtime.js";

class ErrorBoundaryContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null, info: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error("UI crash:", err, info);
    this.setState({ info });
  }

  render() {
    if (this.state.err) {
      const msg = String(this.state.err?.message || this.state.err);
      const stack = String(this.state.err?.stack || "");
      const comp = String(this.state.info?.componentStack || "");

      return (
        <div className="app fatalErrorPage" role="alert">
          <section className="card glassStrong fatalErrorCard">
            <span className="fatalErrorIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 8v5m0 3.5v.1M10.3 4.8 3.5 17a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L13.7 4.8a2 2 0 0 0-3.4 0Z" /></svg>
            </span>
            <div className="sectionKicker">{this.props.t("errorBoundary.kicker")}</div>
            <h1 className="sectionTitle">{this.props.t("errorBoundary.title")}</h1>
            <p>{this.props.t("errorBoundary.help")}</p>
            <button type="button" className="pill pillWarm" onClick={reloadCurrentPage}>
              {this.props.t("errorBoundary.reload")}
            </button>
            <details>
              <summary>{this.props.t("errorBoundary.details")}</summary>
              <pre>
                {this.props.t("errorBoundary.messageLabel")} {msg}
                {`\n\n${stack || this.props.t("errorBoundary.noStack")}`}
                {comp ? `\n\n${this.props.t("errorBoundary.componentStack")}\n${comp}` : ""}
              </pre>
            </details>
          </section>
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
