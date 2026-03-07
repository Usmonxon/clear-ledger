import { useNavigate, useLocation } from "react-router-dom";

const tabs = [
  { label: "ДДС", path: "/cashflow" },
  { label: "ОПУ", path: "/pnl" },
];

export function MobileReportTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            pathname === tab.path
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
