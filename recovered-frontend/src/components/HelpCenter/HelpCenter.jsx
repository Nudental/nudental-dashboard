import React, { useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HELP_ARTICLES from "./helpArticles";
import { useHelp } from "../../contexts/HelpContext";

function HelpDrawer({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const results = !searchQuery?.trim()
    ? HELP_ARTICLES
    : HELP_ARTICLES?.filter((a) => {
        const q = searchQuery?.toLowerCase();
        return (a?.title?.toLowerCase()?.includes(q) ||
        a?.content?.toLowerCase()?.includes(q) ||
        a?.keywords?.some((k) => k?.includes(q)) || a?.tab?.toLowerCase()?.includes(q));
      });

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setExpanded(null);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e) {
      if (e?.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Dark overlay backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Drawer panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 9999,
          height: "100vh",
          width: "min(400px, 100vw)",
          backgroundColor: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 32px rgba(15,23,42,0.18)",
          borderLeft: "1px solid #e2e8f0",
        }}
      >
        {/* Teal header */}
        <div
          style={{
            backgroundColor: "#0d9488",
            padding: "16px 20px 14px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                Help Center
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 3 }}>
                NuDashboard — NU Dental
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.15)",
                border: "none",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* View Full Manual Button */}
        <div
          style={{
            padding: "10px 16px 0",
            flexShrink: 0,
            backgroundColor: "#fff",
          }}
        >
          <button
            onClick={() => {
              onClose();
              navigate("/help/manual");
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "10px",
              background: "#00838F",
              color: "white",
              textAlign: "center",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "12px",
              fontSize: 14,
            }}
          >
            📖 View Full User Manual
          </button>
        </div>

        {/* Search bar */}
        <div
          style={{
            padding: "12px 16px 8px",
            borderBottom: "1px solid #f1f5f9",
            flexShrink: 0,
            backgroundColor: "#fff",
          }}
        >
          <input
            type="text"
            placeholder="Search... (e.g. huddle, goals, KPI)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e?.target?.value);
              setExpanded(null);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 13,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              outline: "none",
              backgroundColor: "#f8fafc",
              color: "#334155",
              boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
            {results?.length} article{results?.length !== 1 ? "s" : ""} found
          </div>
        </div>

        {/* Article list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {results?.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14 }}>No results found</div>
            </div>
          )}

          {results?.map((article) => (
            <div
              key={article?.id}
              style={{
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              {/* Article header row */}
              <button
                onClick={() => setExpanded(expanded === article?.id ? null : article?.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#0d9488",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 3,
                    }}
                  >
                    {article?.tab}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#1e293b",
                      lineHeight: 1.4,
                    }}
                  >
                    {article?.title}
                  </div>
                </div>
                <span style={{ color: "#94a3b8", fontSize: 12, flexShrink: 0 }}>
                  {expanded === article?.id ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded inline content */}
              {expanded === article?.id && (
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                    padding: "12px 16px 14px",
                    fontSize: 13,
                    color: "#475569",
                    lineHeight: 1.6,
                  }}
                >
                  {article?.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
            flexShrink: 0,
            backgroundColor: "#fafafa",
          }}
        >
          Making smiles and beauty for life! 🦷
        </div>
      </div>
    </>
  );
}

export default function HelpCenter() {
  const { helpOpen, setHelpOpen } = useHelp();

  return (
    <>
      {/* Floating ? button */}
      <button
        onClick={() => setHelpOpen(true)}
        aria-label="Open Help Center"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 50,
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: "#0d9488",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(13,148,136,0.35)",
          transition: "transform 0.15s, background-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0f766e")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0d9488")}
      >
        <HelpCircle size={22} />
      </button>

      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
