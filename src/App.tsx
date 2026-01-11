import { useEffect, useRef, useState } from "react";
import { initSheet } from "./sheet";
import { isEntitledForApp, openAppBrowser, readLaunchToken } from "@enderfall/runtime";
import { AccessGate, applyTheme, getStoredTheme } from "@enderfall/ui";

type ThemeMode = "atelier" | "system" | "light" | "dark";

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "atelier", label: "Atelier" },
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const isTauri = typeof window !== "undefined" && "__TAURI_IPC__" in window;
const appId = "character-creation-sheet";

const IconChevronDown = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 9l6 6 6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function App() {
  const [menuOpen, setMenuOpen] = useState<"file" | "edit" | "view" | "help" | null>(null);
  const menuCloseRef = useRef<number | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    getStoredTheme({
      storageKey: "themeMode",
      defaultTheme: "atelier",
      allowed: ["atelier", "system", "light", "dark"],
    })
  );
  const [entitlementStatus, setEntitlementStatus] = useState<"checking" | "allowed" | "locked">(
    isTauri ? "checking" : "allowed"
  );
  const [requestedBrowser, setRequestedBrowser] = useState(false);
  const [isPremium, setIsPremium] = useState(!isTauri);

  useEffect(() => {
    return initSheet();
  }, []);

  useEffect(() => {
    applyTheme(themeMode, {
      storageKey: "themeMode",
      defaultTheme: "atelier",
      allowed: ["atelier", "system", "light", "dark"],
    });
  }, [themeMode]);

  useEffect(() => {
    if (isTauri) return;
    const params = new URLSearchParams(window.location.search);
    setIsPremium(params.get("tier") === "premium");
  }, []);

  const refreshEntitlement = async () => {
    if (!isTauri) {
      setEntitlementStatus("allowed");
      setIsPremium(true);
      return;
    }
    const token = await readLaunchToken(appId);
    const allowed = isEntitledForApp(token, appId);
    setEntitlementStatus(allowed ? "allowed" : "locked");
    setIsPremium(allowed);
  };

  useEffect(() => {
    refreshEntitlement();
  }, []);

  useEffect(() => {
    if (entitlementStatus !== "locked" || requestedBrowser) return;
    setRequestedBrowser(true);
    openAppBrowser(appId);
  }, [entitlementStatus, requestedBrowser]);

  const openMenu = (name: "file" | "edit" | "view" | "help") => {
    if (menuCloseRef.current !== null) {
      window.clearTimeout(menuCloseRef.current);
      menuCloseRef.current = null;
    }
    setMenuOpen(name);
  };

  const closeMenu = () => {
    if (menuCloseRef.current !== null) {
      window.clearTimeout(menuCloseRef.current);
    }
    menuCloseRef.current = window.setTimeout(() => {
      setMenuOpen(null);
      menuCloseRef.current = null;
    }, 150);
  };

  const triggerImport = () => {
    if (!isPremium) return;
    const input = document.getElementById("importFile") as HTMLInputElement | null;
    input?.click();
    setMenuOpen(null);
  };

  const triggerExport = () => {
    if (!isPremium) return;
    const button = document.getElementById("exportBtn") as HTMLButtonElement | null;
    button?.click();
    setMenuOpen(null);
  };

  const startNewSheet = () => {
    window.location.reload();
  };

  const openAbout = () => {
    window.alert("Character Atelier Sheet");
    setMenuOpen(null);
  };

  return (
    <>
      <AccessGate
        status={entitlementStatus}
        primaryLabel="Open App Browser"
        secondaryLabel="Retry"
        onPrimary={() => openAppBrowser(appId)}
        onSecondary={refreshEntitlement}
        primaryClassName="action-btn"
        secondaryClassName="action-btn"
      />
      <div className="menu-bar">
        <div className="menu-group" onMouseEnter={() => openMenu("file")} onMouseLeave={closeMenu}>
          <button className="menu-button" type="button">
            File
          </button>
          {menuOpen === "file" ? (
            <div className="menu-popover" onMouseEnter={() => openMenu("file")} onMouseLeave={closeMenu}>
              <button
                className="menu-item"
                type="button"
                onClick={triggerImport}
                disabled={!isPremium}
                title={!isPremium ? "Premium required" : undefined}
              >
                Import...
              </button>
              <button
                className="menu-item"
                type="button"
                onClick={triggerExport}
                disabled={!isPremium}
                title={!isPremium ? "Premium required" : undefined}
              >
                Export...
              </button>
              <div className="menu-divider" />
              <button className="menu-item" type="button" onClick={startNewSheet}>
                New sheet
              </button>
            </div>
          ) : null}
        </div>
        <div className="menu-group" onMouseEnter={() => openMenu("edit")} onMouseLeave={closeMenu}>
          <button className="menu-button" type="button">
            Edit
          </button>
          {menuOpen === "edit" ? (
            <div className="menu-popover" onMouseEnter={() => openMenu("edit")} onMouseLeave={closeMenu}>
              <button className="menu-item" type="button" disabled>
                Undo
              </button>
              <button className="menu-item" type="button" disabled>
                Redo
              </button>
            </div>
          ) : null}
        </div>
        <div className="menu-group" onMouseEnter={() => openMenu("view")} onMouseLeave={closeMenu}>
          <button className="menu-button" type="button">
            View
          </button>
          {menuOpen === "view" ? (
            <div className="menu-popover" onMouseEnter={() => openMenu("view")} onMouseLeave={closeMenu}>
              <div className="menu-item has-submenu" role="button" tabIndex={0}>
                <span>Theme</span>
                <span className="menu-sub-caret">
                  <IconChevronDown />
                </span>
                <div className="menu-sub">
                  {themeOptions.map((item) => (
                    <button
                      key={item.value}
                      className="menu-item"
                      type="button"
                      onClick={() => {
                        setThemeMode(item.value);
                        setMenuOpen(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="menu-group" onMouseEnter={() => openMenu("help")} onMouseLeave={closeMenu}>
          <button className="menu-button" type="button">
            Help
          </button>
          {menuOpen === "help" ? (
            <div className="menu-popover" onMouseEnter={() => openMenu("help")} onMouseLeave={closeMenu}>
              <button className="menu-item" type="button" onClick={openAbout}>
                About
              </button>
            </div>
          ) : null}
        </div>
        <div className={`tier-pill ${isPremium ? "premium" : "free"}`}>
          {isPremium ? "Premium" : "Free"}
        </div>
      </div>
      {!isPremium ? (
        <div className="premium-banner">
          Free mode active. Import and export unlock with premium access.
        </div>
      ) : null}
      <div className="frame">
          <div className="sheet">
            <div className="left-panel fade-in">
              <div className="portrait-card">
                <img className="portrait" id="portraitPreview" alt="portrait preview" />
                <div className="portrait-placeholder" id="portraitPlaceholder">Upload Portrait</div>
                <label className="upload-chip">
                  Upload
                  <input type="file" id="portraitInput" accept="image/*" />
                </label>
              </div>
              <div className="bio-card">
                <header>Character Notes</header>
                <div className="note-controls">
                  <select id="noteSelect">
                    <option value="Personality">Personality</option>
                    <option value="Hobbies">Hobbies</option>
                    <option value="Food-Related">Food-Related</option>
                    <option value="Habits">Habits</option>
                    <option value="Quirks">Quirks</option>
                    <option value="Extras">Extras</option>
                  </select>
                  <button type="button" id="addNoteBtn">Add</button>
                </div>
                <div className="notes-scroll" id="notesScroll">
                  <div className="note-section" data-note-title="Personality">
                    <div className="note-header">
                      <span>Personality</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Personality notes"></textarea>
                  </div>
                  <div className="note-section" data-note-title="Hobbies">
                    <div className="note-header">
                      <span>Hobbies</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Hobbies notes"></textarea>
                  </div>
                  <div className="note-section" data-note-title="Food-Related">
                    <div className="note-header">
                      <span>Food-Related</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Food related notes"></textarea>
                  </div>
                  <div className="note-section" data-note-title="Habits">
                    <div className="note-header">
                      <span>Habits</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Habits notes"></textarea>
                  </div>
                  <div className="note-section" data-note-title="Quirks">
                    <div className="note-header">
                      <span>Quirks</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Quirks notes"></textarea>
                  </div>
                  <div className="note-section" data-note-title="Extras">
                    <div className="note-header">
                      <span>Extras</span>
                      <button type="button" className="remove-note">Remove</button>
                    </div>
                    <textarea aria-label="Extras notes"></textarea>
                  </div>
                </div>
              </div>
            </div>
      
            <div className="right-panel fade-in">
              <section className="section" data-section="identity">
                <div className="section-title">Identity</div>
                <div className="identity">
                  <div className="label-row"><span>Name</span><input className="line-input" type="text" defaultValue="Jane Doe" /></div>
                  <div className="label-row"><span>Nickname</span><input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Race/Species</span><input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Age</span><input className="line-input" type="text" defaultValue="XX" /></div>
                  <div className="label-row"><span>Gender</span><input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Birthday</span><input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Class/Job</span><input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Height</span><input className="line-input" type="text" defaultValue="XXX cm" /></div>
                </div>
              </section>
      
              <section className="section" data-section="body">
                <div className="section-title">Body</div>
                <div className="stats-grid">
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Strength</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Dexterity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Health</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Energy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Beauty</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Style</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </div>
              </section>
      
              <div className="core-grid">
                <section className="section" data-section="skills">
                  <div className="section-title">Skills</div>
                  <div className="skill-grid">
                    <div className="mini-list">
                      <div className="dot-row"><span className="stat-chip">Perception</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Communication</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Persuasion</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Mediation</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Literacy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Creativity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Cooking</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Combat</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    </div>
                    <div className="mini-list">
                      <div className="dot-row"><span className="stat-chip">Survival</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Stealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Tech Savvy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Street Smarts</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Seduction</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Animal Handling</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                      <div className="dot-row"><span className="stat-chip">Child Handling</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    </div>
                  </div>
                </section>
      
                <section className="section" data-section="priorities">
                  <div className="section-title">Priorities</div>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Justice</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Truth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Power</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Fame</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Wealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Family</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Friends</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Love</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Home</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Health</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Approval</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </section>
              </div>
      
              <section className="section" data-section="mind">
                <div className="section-title">Mind</div>
                <div className="stats-grid">
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Intelligence</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Happiness</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Spirituality</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Confidence</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="mini-list">
                    <div className="dot-row"><span className="stat-chip">Humor</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Anxiety</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Patience</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Passion</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                </div>
                <div className="stacked" style={{ marginTop: "10px" }}>
                  <div className="range-row"><span>Nice</span><input type="range" min="0" max="100" defaultValue="45" /><span>Mean</span></div>
                  <div className="range-row"><span>Brave</span><input type="range" min="0" max="100" defaultValue="50" /><span>Cowardly</span></div>
                  <div className="range-row"><span>Pacifist</span><input type="range" min="0" max="100" defaultValue="55" /><span>Violent</span></div>
                  <div className="range-row"><span>Thoughtful</span><input type="range" min="0" max="100" defaultValue="45" /><span>Impulsive</span></div>
                  <div className="range-row"><span>Agreeable</span><input type="range" min="0" max="100" defaultValue="40" /><span>Contrary</span></div>
                  <div className="range-row"><span>Idealistic</span><input type="range" min="0" max="100" defaultValue="45" /><span>Pragmatic</span></div>
                  <div className="range-row"><span>Frugal</span><input type="range" min="0" max="100" defaultValue="50" /><span>Big Spender</span></div>
                  <div className="range-row"><span>Extrovert</span><input type="range" min="0" max="100" defaultValue="55" /><span>Introvert</span></div>
                  <div className="range-row"><span>Collected</span><input type="range" min="0" max="100" defaultValue="50" /><span>Wild</span></div>
                </div>
                <div className="traits" style={{ marginTop: "10px" }}>
                  <label><input type="checkbox" />Ambitious</label>
                  <label><input type="checkbox" />Possessive</label>
                  <label><input type="checkbox" />Stubborn</label>
                  <label><input type="checkbox" />Jealous</label>
                  <label><input type="checkbox" />Decisive</label>
                  <label><input type="checkbox" />Perfectionist</label>
                </div>
              </section>
      
              <section className="section social-section" data-section="social">
                <div className="section-title">Social</div>
                <div className="social-content">
                  <div>
                    <div className="dot-row"><span className="stat-chip">Charisma</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Empathy</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Generosity</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Wealth</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Aggression</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                    <div className="dot-row"><span className="stat-chip">Libido</span><div className="dots"><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /><input className="dot-input" type="checkbox" /></div></div>
                  </div>
                  <div className="social-grid">
                    <div className="social-slider"><span>Honest</span><input type="range" min="0" max="100" defaultValue="55" /><span>Deceptive</span></div>
                    <div className="social-slider"><span>Leader</span><input type="range" min="0" max="100" defaultValue="60" /><span>Follower</span></div>
                    <div className="social-slider"><span>Polite</span><input type="range" min="0" max="100" defaultValue="50" /><span>Rude</span></div>
                    <div className="social-slider"><span>Political</span><input type="range" min="0" max="100" defaultValue="45" /><span>Indifferent</span></div>
                  </div>
                  <div className="checkbox-list">
                    <label><input type="checkbox" />Cool</label>
                    <label><input type="checkbox" />Flirty</label>
                    <label><input type="checkbox" />Cute</label>
                    <label><input type="checkbox" />Obedient</label>
                    <label><input type="checkbox" />Fun</label>
                    <label><input type="checkbox" />Forgiving</label>
                    <label><input type="checkbox" />Gullible</label>
                    <label><input type="checkbox" />Scary</label>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      
      <div>
          <button
            className="action-btn"
            id="importBtn"
            type="button"
            disabled={!isPremium}
            title={!isPremium ? "Premium required" : undefined}
          >
            Import
          </button>
          <button
            className="action-btn"
            id="exportBtn"
            type="button"
            disabled={!isPremium}
            title={!isPremium ? "Premium required" : undefined}
          >
            Export
          </button>
          <input type="file" id="importFile" accept="application/json" style={{ display: "none" }} />
        </div>
      
      
    </>
  );
}
