import { useEffect, useRef, useState } from "react";
import { initSheet } from "./sheet";
import { open as openExternal } from "@tauri-apps/api/shell";
import { appWindow } from "@tauri-apps/api/window";
import {
  clearLaunchToken,
  isEntitledForApp,
  openAppBrowser,
  readLaunchToken,
  type LaunchToken,
} from "@enderfall/runtime";
import { AccessGate, Button, Dropdown, Input, MainHeader, Panel, Select, Textarea, applyTheme, getStoredTheme } from "@enderfall/ui";

type ThemeMode = "galaxy" | "atelier" | "system" | "light" | "dark";

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "galaxy", label: "Galaxy" },
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
      defaultTheme: "galaxy",
      allowed: ["galaxy", "atelier", "system", "light", "dark"],
    })
  );
  const [entitlementStatus, setEntitlementStatus] = useState<"checking" | "allowed" | "locked">(
    isTauri ? "checking" : "allowed"
  );
  const [requestedBrowser, setRequestedBrowser] = useState(false);
  const [isPremium, setIsPremium] = useState(!isTauri);
  const [entitlementDebug, setEntitlementDebug] = useState("");
  const [launchToken, setLaunchToken] = useState<LaunchToken | null>(null);
  const portraitInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return initSheet();
  }, []);

  useEffect(() => {
    applyTheme(themeMode, {
      storageKey: "themeMode",
      defaultTheme: "galaxy",
      allowed: ["galaxy", "atelier", "system", "light", "dark"],
    });
    document.body.classList.toggle("ef-galaxy", themeMode === "galaxy");
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
    console.log("[Character Creation] launch token", token);
    setLaunchToken(token);
    const allowed = isEntitledForApp(token, appId);
    setEntitlementStatus(allowed ? "allowed" : "locked");
    setIsPremium(allowed);
    const now = Date.now();
    const expires = token?.expiresAt ?? 0;
    const debug = token
      ? `token ${token.appId} exp ${new Date(expires).toLocaleString()} (${expires - now}ms)`
      : "no token found";
    setEntitlementDebug(debug);
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
    window.alert("Character Creation");
    setMenuOpen(null);
  };

  const displayName =
    launchToken?.displayName || launchToken?.email?.split("@")[0] || "Account";
  const rawAvatarUrl = launchToken?.avatarUrl ?? null;
  const avatarUrl =
    rawAvatarUrl && !rawAvatarUrl.includes("googleusercontent.com") ? rawAvatarUrl : null;

  const openProfile = () => {
    const url = "https://enderfall.co.uk/profile";
    if (isTauri) {
      openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  };

  const focusSelf = async () => {
    if (!isTauri) return;
    await appWindow.show();
    await appWindow.setFocus();
  };

  const handleLogout = async () => {
    await clearLaunchToken(appId);
    setLaunchToken(null);
    setEntitlementStatus("locked");
    setIsPremium(false);
    setEntitlementDebug("logged out");
    await openAppBrowser(appId);
  };

  return (
    <div className="page">
      <AccessGate
        status={entitlementStatus}
        primaryLabel="Open Enderfall Hub"
        secondaryLabel="Retry"
        onPrimary={() => openAppBrowser(appId)}
        onSecondary={refreshEntitlement}
        primaryClassName="action-btn"
        secondaryClassName="action-btn"
        messageLocked={`Open Enderfall Hub to verify premium or admin access. (${entitlementDebug})`}
      />
      <MainHeader
        logoSrc="/brand/enderfall-mark.png"
        menus={[
          {
            id: "file",
            label: "File",
            content: (
              <>
                <button
                  className="ef-menu-item"
                  type="button"
                  onClick={triggerImport}
                  disabled={!isPremium}
                  title={!isPremium ? "Premium required" : undefined}
                >
                  Import...
                </button>
                <button
                  className="ef-menu-item"
                  type="button"
                  onClick={triggerExport}
                  disabled={!isPremium}
                  title={!isPremium ? "Premium required" : undefined}
                >
                  Export...
                </button>
                <div className="ef-menu-divider" />
                <button className="ef-menu-item" type="button" onClick={startNewSheet}>
                  New sheet
                </button>
              </>
            ),
          },
          {
            id: "edit",
            label: "Edit",
            content: (
              <>
                <button className="ef-menu-item" type="button" disabled>
                  Undo
                </button>
                <button className="ef-menu-item" type="button" disabled>
                  Redo
                </button>
              </>
            ),
          },
          {
            id: "view",
            label: "View",
            content: (
              <div className="ef-menu-item has-submenu" role="button" tabIndex={0}>
                <span>Theme</span>
                <span className="ef-menu-sub-caret">
                  <IconChevronDown />
                </span>
                <div className="ef-menu-sub">
                  {themeOptions.map((item) => (
                    <button
                      key={item.value}
                      className="ef-menu-item"
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
            ),
          },
          {
            id: "help",
            label: "Help",
            content: (
              <button className="ef-menu-item" type="button" onClick={openAbout}>
                About
              </button>
            ),
          },
        ]}
        menuOpen={menuOpen}
        onOpenMenu={openMenu}
        onCloseMenu={closeMenu}
        actions={
          <div className="actions">
            <Dropdown
              variant="user"
              name={displayName}
              avatarUrl={avatarUrl}
              avatarFallback={displayName.slice(0, 1).toUpperCase()}
              items={[
                {
                  label: "Open Character Creation",
                  onClick: focusSelf,
                },
                {
                  label: "Open Enderfall Hub",
                  onClick: () => openAppBrowser(appId),
                },
                {
                  label: "Profile",
                  onClick: openProfile,
                },
                {
                  label: "Logout",
                  onClick: handleLogout,
                },
              ]}
            />
          </div>
        }
      />
      {!isPremium ? (
        <div className="premium-banner">
          Free mode active. Import and export unlock with premium access.
        </div>
      ) : null}
      <Panel variant="card" borderWidth={2} className="frame">
          <div className="sheet">
            <div className="left-panel fade-in">
              <Panel variant="card" borderWidth={2} className="portrait-card">
                <img className="portrait" id="portraitPreview" alt="portrait preview" />
                <div className="portrait-placeholder" id="portraitPlaceholder">Upload Portrait</div>
                <Button
                  type="button"
                  className="upload-chip"
                  onClick={() => portraitInputRef.current?.click()}
                >
                  Upload
                </Button>
                <input
                  ref={portraitInputRef}
                  type="file"
                  id="portraitInput"
                  accept="image/*"
                  style={{ display: "none" }}
                />
              </Panel>
              <Panel variant="card" borderWidth={2} className="bio-card">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Character Notes</span>
                </Panel>
                <div className="note-controls">
                  <Select id="noteSelect">
                    <option value="Personality">Personality</option>
                    <option value="Hobbies">Hobbies</option>
                    <option value="Food-Related">Food-Related</option>
                    <option value="Habits">Habits</option>
                    <option value="Quirks">Quirks</option>
                    <option value="Extras">Extras</option>
                  </Select>
                  <Button type="button" id="addNoteBtn">Add</Button>
                </div>
                <div className="notes-scroll" id="notesScroll">
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Personality">
                    <div className="note-header">
                      <span>Personality</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Personality notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Hobbies">
                    <div className="note-header">
                      <span>Hobbies</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Hobbies notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Food-Related">
                    <div className="note-header">
                      <span>Food-Related</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Food related notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Habits">
                    <div className="note-header">
                      <span>Habits</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Habits notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Quirks">
                    <div className="note-header">
                      <span>Quirks</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Quirks notes" />
                  </Panel>
                  <Panel variant="card" borderWidth={1} className="note-section" data-note-title="Extras">
                    <div className="note-header">
                      <span>Extras</span>
                      <Button type="button" variant="delete" className="remove-note">
                        Remove
                      </Button>
                    </div>
                    <Textarea aria-label="Extras notes" />
                  </Panel>
                </div>
              </Panel>
            </div>
      
            <div className="right-panel fade-in">
              <Panel variant="card" borderWidth={2} className="section" data-section="identity">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Identity</span>
                </Panel>
                <div className="identity">
                  <div className="label-row"><span>Name</span><Input className="line-input" type="text" defaultValue="Jane Doe" /></div>
                  <div className="label-row"><span>Nickname</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Race/Species</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Age</span><Input className="line-input" type="text" defaultValue="XX" /></div>
                  <div className="label-row"><span>Gender</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Birthday</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Class/Job</span><Input className="line-input" type="text" defaultValue="Unknown" /></div>
                  <div className="label-row"><span>Height</span><Input className="line-input" type="text" defaultValue="XXX cm" /></div>
                </div>
              </Panel>
      
              <Panel variant="card" borderWidth={2} className="section" data-section="body">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Body</span>
                </Panel>
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
              </Panel>
      
              <div className="core-grid">
                <Panel variant="card" borderWidth={2} className="section" data-section="skills">
                  <Panel variant="highlight" borderWidth={1} className="panel-header">
                    <span className="panel-title">Skills</span>
                  </Panel>
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
                </Panel>
      
                <Panel variant="card" borderWidth={2} className="section" data-section="priorities">
                  <Panel variant="highlight" borderWidth={1} className="panel-header">
                    <span className="panel-title">Priorities</span>
                  </Panel>
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
                </Panel>
              </div>
      
              <Panel variant="card" borderWidth={2} className="section" data-section="mind">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Mind</span>
                </Panel>
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
                <div className="stacked">
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
                <div className="traits">
                  <label><input type="checkbox" />Ambitious</label>
                  <label><input type="checkbox" />Possessive</label>
                  <label><input type="checkbox" />Stubborn</label>
                  <label><input type="checkbox" />Jealous</label>
                  <label><input type="checkbox" />Decisive</label>
                  <label><input type="checkbox" />Perfectionist</label>
                </div>
              </Panel>
      
              <Panel variant="card" borderWidth={2} className="section" data-section="social">
                <Panel variant="highlight" borderWidth={1} className="panel-header">
                  <span className="panel-title">Social</span>
                </Panel>
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
              </Panel>
            </div>
          </div>
        </Panel>
      
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
      
      
    </div>
  );
}

