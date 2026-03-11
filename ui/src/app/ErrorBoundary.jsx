import React from "react";

export default class ErrorBoundary extends React.Component {
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
          <div className="card glassStrong" style={{ padding: 16, border: "1px solid rgba(255,120,120,0.45)" }}>
            <div className="sectionKicker">Fehler</div>
            <div className="sectionTitle" style={{ marginTop: 6 }}>
              UI ist abgestürzt
            </div>

            <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>
              <b>Message:</b> {msg}
              <div style={{ marginTop: 8, opacity: 0.8 }}>
                Kopier mir diese Box + Console-Log hier rein, dann fixen wir es sauber.
              </div>
            </div>

            <pre
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                overflow: "auto",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.10)",
                fontSize: 12,
                color: "rgba(255,255,255,0.86)",
                whiteSpace: "pre-wrap",
              }}
            >
              {stack || "(no stack)"}
              {comp ? `\n\n--- component stack ---\n${comp}` : ""}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
