import YearComparisonPanel from "../../ui/YearComparisonPanel.jsx";

function comparisonRightYear(year, availableYears) {
  const alternatives = (availableYears || []).filter((entry) => Number(entry) !== Number(year));
  return alternatives[0] ?? year;
}

export default function CompareMode({ availableYears, year }) {
  return (
    <YearComparisonPanel
      key={`analysis-comparison-${year}`}
      availableYears={availableYears}
      initialLeftYear={year}
      initialRightYear={comparisonRightYear(year, availableYears)}
    />
  );
}
