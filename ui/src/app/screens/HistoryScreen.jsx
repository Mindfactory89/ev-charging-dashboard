import AddSessionCard from "../../ui/AddSessionCard.jsx";
import ImportSessionsCard from "../../ui/ImportSessionsCard.jsx";
import SessionsCard from "../../ui/SessionsCard.jsx";

export default function HistoryScreen({
  addOpen,
  addPanelRef,
  addSectionRef,
  closeAdd,
  demo,
  historyFilters,
  intelligence,
  onCreated,
  onClearHistoryFilters,
  onHistoryFiltersChange,
  openAdd,
  sessionOutliersById,
  sessionScoresById,
  sessions,
  year,
}) {
  return (
    <>
      <section className="row">
        <div className="card glassStrong premiumDataIntro">
          <div className="premiumDataIntroEyebrow">Verlauf</div>
          <div className="premiumDataIntroTitle">Sessions pflegen ohne visuelle Unruhe</div>
          <div className="premiumDataIntroText">
            Tabelle, Inline-Edit und Composer sind hier bewusst separat gebündelt. So bleibt die Übersicht oben ruhig
            und die operative Pflege unten schnell.
          </div>
        </div>
      </section>

      <section className="row">
        <SessionsCard
          filters={historyFilters}
          intelligence={intelligence}
          onFiltersChange={onHistoryFiltersChange}
          sessions={sessions}
          year={year}
          onChanged={onCreated}
          sessionScoresById={sessionScoresById}
          sessionOutliersById={sessionOutliersById}
        />
      </section>

      <section className="row" style={{ marginTop: 18 }}>
        <ImportSessionsCard onImported={onCreated} sessions={sessions} />
      </section>

      <section className="row" ref={addSectionRef} style={{ marginTop: 18 }}>
        <div className={`card glassStrong addComposer ${addOpen ? "open" : "closed"}`}>
          <div className="addComposerGlow" aria-hidden="true" />

          <div className="addComposerInner">
            <div className="panelHeader">
              <div>
                <div className="sectionKicker">Action</div>
                <div className="sectionTitle sectionTitleSpaced">Ladevorgang hinzufügen</div>
              </div>

              <div className="panelActions">
                {(historyFilters?.month || historyFilters?.provider || historyFilters?.location || historyFilters?.vehicle || historyFilters?.tag) ? (
                  <button
                    type="button"
                    className="pill ghostPill"
                    onClick={onClearHistoryFilters}
                    style={{ cursor: "pointer" }}
                  >
                    Filter löschen
                  </button>
                ) : null}
                {!addOpen ? (
                  <button type="button" className="pill pillWarm" onClick={openAdd} aria-expanded={addOpen} style={{ cursor: "pointer" }}>
                    Öffnen ↓
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pill ghostPill"
                    onClick={closeAdd}
                    aria-expanded={addOpen}
                    style={{ cursor: "pointer" }}
                  >
                    Einklappen
                  </button>
                )}
              </div>
            </div>

            {!addOpen ? (
              <div className="addComposerClosed">
                <div className="addComposerLead">
                  Neue Session direkt im Verlauf ergänzen. So bleibt die Übersicht oberhalb ruhig und die Pflege
                  darunter fokussiert.
                </div>
                <div className="addComposerMiniGrid">
                  <div className="summaryCard warm addComposerStatCard">
                    <div className="summaryLabel">Live Sync</div>
                    <div className="summaryValue">Sofort</div>
                    <div className="summarySub">fließt direkt in Vergleich, Forecast und Score ein</div>
                  </div>
                  <div className="summaryCard addComposerStatCard">
                    <div className="summaryLabel">Pflegezone</div>
                    <div className="summaryValue">Nur Verlauf</div>
                    <div className="summarySub">Sessions pflegen, ohne die Analysefläche zu überladen</div>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={addPanelRef} tabIndex={-1} className="addComposerFrame">
                <AddSessionCard onCreated={onCreated} demo={demo} intelligence={intelligence} sessions={sessions} />
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
