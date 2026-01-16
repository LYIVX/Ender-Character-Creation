let portraitData = "";
let defaultsSnapshot = null;
const pointsCapBySection = {
  body: 20,
  skills: 50,
  priorities: 25,
  mind: 20,
  social: 15,
};

const sectionByName = (name) => {
  return document.querySelector(`[data-section="${name}"]`);
};

const getDotRows = (section) => {
  if (!section) return {};
  const result = {};
  const legacyRows = section.querySelectorAll(".dot-row");
  legacyRows.forEach((row) => {
    const label = row.querySelector(".stat-chip")?.textContent.trim() || "Unknown";
    const count = row.querySelectorAll(".dot-input:checked").length;
    result[label] = count;
  });
  const statGroups = section.querySelectorAll(".ef-stat-dots");
  statGroups.forEach((group) => {
    const label = group.querySelector(".ef-stat-dots__label")?.textContent.trim() || "Unknown";
    const count = group.querySelectorAll(".ef-stat-dots__input:checked").length;
    result[label] = count;
  });
  return result;
};

const setStatDotsValue = (group, count) => {
  const inputs = Array.from(group.querySelectorAll(".ef-stat-dots__input"));
  if (!inputs.length) return;
  const safeCount = Math.max(0, Math.min(inputs.length, count));
  const current = inputs.filter((input) => input.checked).length;
  if (safeCount === current) return;
  if (safeCount === 0) {
    const lastChecked = inputs.filter((input) => input.checked).pop();
    if (lastChecked) {
      lastChecked.disabled = false;
      lastChecked.click();
    }
    return;
  }
  const target = inputs[safeCount - 1];
  target.disabled = false;
  target.click();
};

const clearDotRows = (section) => {
  if (!section) return;
  section.querySelectorAll(".dot-input").forEach((input) => {
    input.checked = false;
    input.disabled = false;
  });
  const statGroups = section.querySelectorAll(".ef-stat-dots");
  statGroups.forEach((group) => {
    setStatDotsValue(group, 0);
  });
};

const setDotRows = (section, data) => {
  if (!section || !data) return;
  const legacyRows = section.querySelectorAll(".dot-row");
  legacyRows.forEach((row) => {
    const label = row.querySelector(".stat-chip")?.textContent.trim() || "Unknown";
    if (!(label in data)) {
      return;
    }
    const count = Number(data[label]) || 0;
    const dots = Array.from(row.querySelectorAll(".dot-input"));
    dots.forEach((dot, index) => {
      dot.checked = index < count;
    });
  });
  const statGroups = section.querySelectorAll(".ef-stat-dots");
  statGroups.forEach((group) => {
    const label = group.querySelector(".ef-stat-dots__label")?.textContent.trim() || "Unknown";
    if (!(label in data)) {
      return;
    }
    const count = Number(data[label]) || 0;
    setStatDotsValue(group, count);
  });
};

const getIdentity = () => {
  const identity = {};
  document.querySelectorAll(".identity .label-row").forEach((row) => {
    const key = row.querySelector("span")?.textContent.trim() || "Unknown";
    const input = row.querySelector("input");
    identity[key] = input ? input.value : "";
  });
  return identity;
};

const collectNotes = () => {
  return Array.from(document.querySelectorAll(".note-section")).map((section) => {
    return {
      title: section.dataset.noteTitle || "Untitled",
      text: section.querySelector("textarea")?.value || ""
    };
  });
};

const createNoteSection = (title, text) => {
  const section = document.createElement("div");
  section.className = "note-section";
  section.dataset.noteTitle = title;
  section.innerHTML = `
        <div class="note-header">
          <span>${title}</span>
          <button type="button" class="remove-note ef-button ef-button--delete">Remove</button>
        </div>
        <textarea class="ef-textarea" aria-label="${title} notes"></textarea>
      `;
  const textarea = section.querySelector("textarea");
  if (textarea) {
    textarea.value = text || "";
  }
  return section;
};

const setNotes = (notes) => {
  if (!Array.isArray(notes)) {
    return;
  }
  const scroll = document.getElementById("notesScroll");
  if (!scroll) {
    return;
  }
  scroll.innerHTML = "";
  notes.forEach((note) => {
    scroll.appendChild(createNoteSection(note.title, note.text));
  });
  resizeNoteTextareas();
};

const setIdentity = (data) => {
  if (!data) {
    return;
  }
  document.querySelectorAll(".identity .label-row").forEach((row) => {
    const key = row.querySelector("span")?.textContent.trim() || "Unknown";
    const input = row.querySelector("input");
    if (input && key in data) {
      input.value = data[key] ?? "";
    }
  });
};

const resizeNoteTextareas = () => {
  const areas = document.querySelectorAll(".note-section textarea");
  areas.forEach((area) => {
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  });
};

const getSliders = (section, selector) => {
  if (!section) return {};
  const sliders = {};
  section.querySelectorAll(selector).forEach((row) => {
    const left = row.querySelector("span")?.textContent.trim() || "Left";
    const spans = row.querySelectorAll("span");
    const right = spans[1]?.textContent.trim() || "Right";
    const input = row.querySelector("input[type=\"range\"]");
    const key = `${left} / ${right}`;
    sliders[key] = input ? Number(input.value) : 0;
  });
  return sliders;
};

const setSliders = (section, selector, data) => {
  if (!section || !data) {
    return;
  }
  section.querySelectorAll(selector).forEach((row) => {
    const spans = row.querySelectorAll("span");
    const left = spans[0]?.textContent.trim() || "Left";
    const right = spans[1]?.textContent.trim() || "Right";
    const key = `${left} / ${right}`;
    const input = row.querySelector("input[type=\"range\"]");
    if (input && key in data) {
      input.value = data[key];
    }
  });
};

const getChecks = (section, selector) => {
  if (!section) return {};
  const result = {};
  section.querySelectorAll(selector).forEach((label) => {
    const text = label.textContent.trim();
    const input = label.querySelector("input[type=\"checkbox\"]");
    result[text] = input ? input.checked : false;
  });
  return result;
};

const setChecks = (section, selector, data) => {
  if (!section || !data) {
    return;
  }
  section.querySelectorAll(selector).forEach((label) => {
    const text = label.textContent.trim();
    const input = label.querySelector("input[type=\"checkbox\"]");
    if (input && text in data) {
      input.checked = !!data[text];
    }
  });
};

const clearChecksIn = (section, selector) => {
  if (!section) return;
  section.querySelectorAll(selector).forEach((label) => {
    const input = label.querySelector("input[type=\"checkbox\"]");
    if (input) {
      input.checked = false;
      input.disabled = false;
    }
  });
};

const getState = () => {
  const body = sectionByName("body");
  const skills = sectionByName("skills");
  const priorities = sectionByName("priorities");
  const mind = sectionByName("mind");
  const social = sectionByName("social");

  return {
    identity: getIdentity(),
    notes: collectNotes(),
    body: { stats: getDotRows(body) },
    skills: { stats: getDotRows(skills) },
    priorities: { stats: getDotRows(priorities) },
    mind: {
      stats: getDotRows(mind),
      sliders: getSliders(mind, ".range-row"),
      traits: getChecks(mind, ".traits label")
    },
    social: {
      stats: getDotRows(social),
      sliders: getSliders(social, ".social-slider"),
      traits: getChecks(social, ".checkbox-list label")
    }
  };
};

const getSectionPointsUsed = (sectionName) => {
  const section = sectionByName(sectionName);
  if (!section) return 0;
  const dots = section.querySelectorAll(
    ".dot-input:checked, .ef-stat-dots__input:checked"
  ).length;
  if (sectionName === "mind" || sectionName === "social") {
    return dots;
  }
  const toggles = section.querySelectorAll(
    ".traits input[type=\"checkbox\"]:checked, .checkbox-list input[type=\"checkbox\"]:checked"
  ).length;
  return dots + toggles;
};

const getPointsUsed = () => {
  return Object.keys(pointsCapBySection).reduce(
    (total, sectionName) => total + getSectionPointsUsed(sectionName),
    0
  );
};

const updatePointsDisplay = () => {
  Object.keys(pointsCapBySection).forEach((sectionName) => {
    const counter = document.getElementById(`pointsCounter-${sectionName}`);
    if (!counter) return;
    const used = getSectionPointsUsed(sectionName);
    const remaining = Math.max(0, pointsCapBySection[sectionName] - used);
    counter.textContent = `Points ${remaining}/${pointsCapBySection[sectionName]}`;
    enforceSectionCap(sectionName);
  });
};

const schedulePointsUpdate = () => {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      updatePointsDisplay();
    });
  });
};

const enforceSectionCap = (sectionName) => {
  const section = sectionByName(sectionName);
  if (!section) return;
  const cap = pointsCapBySection[sectionName] ?? 0;
  const used = getSectionPointsUsed(sectionName);
  const remaining = cap - used;
  const isMindOrSocial = sectionName === "mind" || sectionName === "social";
  const dotGroups = section.querySelectorAll(".ef-stat-dots__dots");
  dotGroups.forEach((group) => {
    const inputs = Array.from(group.querySelectorAll(".ef-stat-dots__input"));
    const currentValue = inputs.filter((input) => input.checked).length;
    inputs.forEach((input, index) => {
      if (input.checked) {
        input.disabled = false;
        return;
      }
      const desiredValue = index + 1;
      const delta = desiredValue - currentValue;
      input.disabled = remaining <= 0 || delta > remaining;
    });
  });

  const legacyDots = Array.from(section.querySelectorAll(".dot-input"));
  if (legacyDots.length) {
    const currentValue = legacyDots.filter((input) => input.checked).length;
    legacyDots.forEach((input, index) => {
      if (input.checked) {
        input.disabled = false;
        return;
      }
      const desiredValue = index + 1;
      const delta = desiredValue - currentValue;
      input.disabled = remaining <= 0 || delta > remaining;
    });
  }

  const toggles = section.querySelectorAll(
    ".traits input[type=\"checkbox\"], .checkbox-list input[type=\"checkbox\"]"
  );
  toggles.forEach((input) => {
    if (isMindOrSocial) {
      input.disabled = false;
      return;
    }
    input.disabled = remaining <= 0 && !input.checked;
  });
};

const applySnapshot = (data) => {
  if (!data) return;
  setIdentity(data.identity);
  if (data.notes !== undefined) {
    setNotes(data.notes);
  }
  clearDotRows(sectionByName("body"));
  if (data.body?.stats) {
    setDotRows(sectionByName("body"), data.body.stats);
  }
  clearDotRows(sectionByName("skills"));
  if (data.skills?.stats) {
    setDotRows(sectionByName("skills"), data.skills.stats);
  }
  clearDotRows(sectionByName("priorities"));
  if (data.priorities?.stats) {
    setDotRows(sectionByName("priorities"), data.priorities.stats);
  }
  clearDotRows(sectionByName("mind"));
  if (data.mind?.stats) {
    setDotRows(sectionByName("mind"), data.mind.stats);
  }
  if (data.mind?.sliders) {
    setSliders(sectionByName("mind"), ".range-row", data.mind.sliders);
  }
  clearChecksIn(sectionByName("mind"), ".traits label");
  if (data.mind?.traits) {
    setChecks(sectionByName("mind"), ".traits label", data.mind.traits);
  }
  clearDotRows(sectionByName("social"));
  if (data.social?.stats) {
    setDotRows(sectionByName("social"), data.social.stats);
  }
  if (data.social?.sliders) {
    setSliders(sectionByName("social"), ".social-slider", data.social.sliders);
  }
  clearChecksIn(sectionByName("social"), ".checkbox-list label");
  if (data.social?.traits) {
    setChecks(sectionByName("social"), ".checkbox-list label", data.social.traits);
  }
  resizeNoteTextareas();
  updatePointsDisplay();
};

const buildBlankSnapshot = () => {
  const base = defaultsSnapshot ?? getState();
  const identity = {};
  Object.keys(base?.identity ?? {}).forEach((key) => {
    identity[key] = "";
  });
  return {
    version: 2,
    identity,
    notes: [],
    body: { stats: {} },
    skills: { stats: {} },
    priorities: { stats: {} },
    mind: {
      stats: {},
      sliders: base?.mind?.sliders ?? {},
      traits: {},
    },
    social: {
      stats: {},
      sliders: base?.social?.sliders ?? {},
      traits: {},
    },
    portrait: null,
  };
};

const getDefaultRangeValue = (input) => {
  if (!input) return 0;
  const raw = input.defaultValue || input.getAttribute("value") || input.min || "0";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};

const getDefaultIdentityFromDom = () => {
  const identity = {};
  document.querySelectorAll(".identity .label-row").forEach((row) => {
    const key = row.querySelector("span")?.textContent.trim() || "Unknown";
    const input = row.querySelector("input");
    identity[key] = input ? input.defaultValue ?? "" : "";
  });
  return identity;
};

const getDefaultNotesFromDom = () => {
  const select = document.getElementById("noteSelect");
  if (select && "options" in select) {
    return Array.from(select.options).map((option) => ({
      title: option.value || option.textContent || "Untitled",
      text: "",
    }));
  }
  return Array.from(document.querySelectorAll(".note-section")).map((section) => {
    const title = section.dataset.noteTitle || "Untitled";
    const textarea = section.querySelector("textarea");
    return {
      title,
      text: textarea ? textarea.defaultValue ?? "" : "",
    };
  });
};

const getDefaultSlidersFromDom = (sectionName, selector) => {
  const section = sectionByName(sectionName);
  if (!section) return {};
  const sliders = {};
  section.querySelectorAll(selector).forEach((row) => {
    const spans = row.querySelectorAll("span");
    const left = spans[0]?.textContent.trim() || "Left";
    const right = spans[1]?.textContent.trim() || "Right";
    const key = `${left} / ${right}`;
    const input = row.querySelector("input[type=\"range\"]");
    sliders[key] = getDefaultRangeValue(input);
  });
  return sliders;
};

const buildDefaultSnapshot = () => {
  return {
    version: 2,
    identity: getDefaultIdentityFromDom(),
    notes: getDefaultNotesFromDom(),
    body: { stats: {} },
    skills: { stats: {} },
    priorities: { stats: {} },
    mind: {
      stats: {},
      sliders: getDefaultSlidersFromDom("mind", ".range-row"),
      traits: {},
    },
    social: {
      stats: {},
      sliders: getDefaultSlidersFromDom("social", ".social-slider"),
      traits: {},
    },
    portrait: null,
  };
};

const resetToDefaults = () => {
  if (!defaultsSnapshot) return;
  applySnapshot(defaultsSnapshot);
  portraitData = "";
  const preview = document.getElementById("portraitPreview");
  const placeholder = document.getElementById("portraitPlaceholder");
  if (preview) {
    preview.src = "";
  }
  if (placeholder) {
    placeholder.style.display = "";
  }
  updatePointsDisplay();
};

const hardResetSheet = () => {
  const frame = document.querySelector(".frame");
  clearDotRows(sectionByName("body"));
  clearDotRows(sectionByName("skills"));
  clearDotRows(sectionByName("priorities"));
  clearDotRows(sectionByName("mind"));
  clearDotRows(sectionByName("social"));
  clearChecksIn(sectionByName("mind"), ".traits label");
  clearChecksIn(sectionByName("social"), ".checkbox-list label");
  if (frame) {
    const fields = Array.from(frame.querySelectorAll("input, textarea")).filter(
      (el) => el.type !== "file"
    );
    fields.forEach((el) => {
      if (el.type === "checkbox") {
        if (
          el.classList.contains("ef-stat-dots__input") ||
          el.classList.contains("dot-input")
        ) {
          return;
        }
        el.checked = el.defaultChecked;
      } else if (el.type === "range") {
        const fallback = el.defaultValue || el.min || "0";
        el.value = fallback;
      } else {
        el.value = el.defaultValue ?? "";
      }
    });
  }
  portraitData = "";
  const preview = document.getElementById("portraitPreview");
  const placeholder = document.getElementById("portraitPlaceholder");
  if (preview) {
    preview.src = "";
  }
  if (placeholder) {
    placeholder.style.display = "";
  }
  updatePointsDisplay();
};

export const resetSheetToDefaults = () => {
  resetToDefaults();
  const fields = Array.from(document.querySelectorAll(".frame input, .frame textarea")).filter(
    (el) => el.type !== "file"
  );
  fields.forEach((el) => {
    if (el.type === "checkbox") {
      el.checked = el.defaultChecked;
    } else if (el.type === "range") {
      const min = Number(el.min);
      el.value = Number.isFinite(min) ? String(min) : "0";
    } else {
      const defaultValue = el.defaultValue ?? "";
      el.value = defaultValue;
    }
  });
  resizeNoteTextareas();
  updatePointsDisplay();
};

export const getBlankSnapshot = () => buildBlankSnapshot();
export const getDefaultSnapshot = () => buildDefaultSnapshot();

const resetStatDotsIn = (container) => {
  if (!container) return;
  const groups = container.querySelectorAll(".ef-stat-dots__dots");
  groups.forEach((group) => {
    const checked = group.querySelectorAll(".ef-stat-dots__input:checked");
    if (checked.length) {
      const lastChecked = checked[checked.length - 1];
      lastChecked.disabled = false;
      lastChecked.click();
    }
  });
  const legacyGroups = container.querySelectorAll(".dots");
  legacyGroups.forEach((group) => {
    const checked = group.querySelectorAll(".dot-input:checked");
    if (checked.length) {
      const lastChecked = checked[checked.length - 1];
      lastChecked.disabled = false;
      lastChecked.click();
    }
  });
};

const resetTogglesIn = (container) => {
  if (!container) return;
  const toggles = container.querySelectorAll(
    ".traits input[type=\"checkbox\"], .checkbox-list input[type=\"checkbox\"]"
  );
  toggles.forEach((input) => {
    input.checked = false;
    input.disabled = false;
  });
};

export const resetSheetToBlank = () => {
  resetToDefaults();
  const frame = document.querySelector(".frame");
  resetStatDotsIn(frame);
  resetTogglesIn(frame);
  const fields = Array.from(document.querySelectorAll(".frame input, .frame textarea")).filter(
    (el) => el.type !== "file"
  );
  fields.forEach((el) => {
    if (el.type === "range") {
      const min = Number(el.min);
      el.value = Number.isFinite(min) ? String(min) : "0";
    } else if (el.type !== "checkbox") {
      el.value = "";
    }
  });
  resizeNoteTextareas();
  schedulePointsUpdate();
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
};

export const resetSectionPoints = (sectionName) => {
  const section = sectionByName(sectionName);
  if (!section) return;
  resetStatDotsIn(section);
  resetTogglesIn(section);
  schedulePointsUpdate();
};

export const getSheetSnapshot = () => {
  const state = getState();
  return {
    version: 2,
    ...state,
    portrait: portraitData || null
  };
};

export const applySheetSnapshot = (data) => {
  if (!data) {
    hardResetSheet();
    return;
  }
  if (Array.isArray(data.fields)) {
    hardResetSheet();
    const fields = Array.from(document.querySelectorAll(".frame input, .frame textarea"))
      .filter((el) => el.type !== "file");
    data.fields.forEach((item, index) => {
      const el = fields[index];
      if (!el) {
        return;
      }
      if (item.t === "c") {
        el.checked = !!item.v;
      } else {
        el.value = item.v ?? "";
      }
    });
  } else {
    hardResetSheet();
    applySnapshot(data);
  }
  if (data.portrait) {
    portraitData = data.portrait;
    const preview = document.getElementById("portraitPreview");
    const placeholder = document.getElementById("portraitPlaceholder");
    if (preview) {
      preview.src = portraitData;
    }
    if (placeholder) {
      placeholder.style.display = "none";
    }
  }
};

export function initSheet() {
  const portraitInput = document.getElementById("portraitInput");
  const portraitPreview = document.getElementById("portraitPreview");
  const portraitPlaceholder = document.getElementById("portraitPlaceholder");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const noteSelect = document.getElementById("noteSelect");
  const notesScroll = document.getElementById("notesScroll");

  if (
    !portraitInput ||
    !portraitPreview ||
    !portraitPlaceholder ||
    !addNoteBtn ||
    !noteSelect ||
    !notesScroll
  ) {
    return () => {};
  }

  const controller = new AbortController();
  const { signal } = controller;

  portraitInput.addEventListener(
    "change",
    (event) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        portraitData = reader.result;
        portraitPreview.src = portraitData;
        portraitPlaceholder.style.display = "none";
      };
      reader.readAsDataURL(file);
    },
    { signal }
  );

  document.querySelectorAll(".dots").forEach((group) => {
    const boxes = Array.from(group.querySelectorAll("input[type=\"checkbox\"]"));
    boxes.forEach((box, index) => {
      box.addEventListener(
        "click",
        () => {
          const sectionName = box.closest("[data-section]")?.getAttribute("data-section");
          const cap =
            sectionName && sectionName in pointsCapBySection
              ? pointsCapBySection[sectionName]
              : 0;
          const currentGroupCount = boxes.filter((item) => item.checked).length;
          const sectionUsed = sectionName ? getSectionPointsUsed(sectionName) : 0;
          const otherPoints = sectionUsed - currentGroupCount;
          const targetCount = box.checked ? index + 1 : index;
          const allowed = Math.max(0, cap - otherPoints);
          const nextCount = box.checked ? Math.min(targetCount, allowed) : targetCount;
          boxes.forEach((item, i) => {
            item.checked = i < nextCount;
          });
          updatePointsDisplay();
        },
        { signal }
      );
    });
  });

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.classList.contains("ef-stat-dots__input")) return;
      const group = target.closest(".ef-stat-dots__dots");
      if (!group) return;
      const sectionName = target.closest("[data-section]")?.getAttribute("data-section");
      const cap =
        sectionName && sectionName in pointsCapBySection ? pointsCapBySection[sectionName] : 0;
      const inputs = Array.from(group.querySelectorAll(".ef-stat-dots__input"));
      const currentValue = inputs.filter((input) => input.checked).length;
      const targetIndex = inputs.indexOf(target) + 1;
      if (targetIndex <= 0) return;
      const desiredValue = targetIndex === currentValue ? 0 : targetIndex;
      if (desiredValue <= currentValue) return;
      const sectionUsed = sectionName ? getSectionPointsUsed(sectionName) : 0;
      const otherPoints = sectionUsed - currentValue;
      if (otherPoints + desiredValue > cap) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true, signal }
  );

  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "checkbox") return;
      if (
        !target.classList.contains("ef-stat-dots__input") &&
        !target.classList.contains("dot-input") &&
        !target.closest(".traits") &&
        !target.closest(".checkbox-list")
      ) {
        return;
      }
      updatePointsDisplay();
    },
    { signal }
  );

  document
    .querySelectorAll(".traits input[type=\"checkbox\"], .checkbox-list input[type=\"checkbox\"]")
    .forEach((toggle) => {
      toggle.addEventListener(
        "change",
        () => {
          const sectionName = toggle.closest("[data-section]")?.getAttribute("data-section");
          const cap =
            sectionName && sectionName in pointsCapBySection
              ? pointsCapBySection[sectionName]
              : 0;
          const used = sectionName ? getSectionPointsUsed(sectionName) : 0;
          if (used > cap) {
            toggle.checked = false;
          }
          updatePointsDisplay();
        },
        { signal }
      );
    });

  document.querySelectorAll("input[type=\"range\"]").forEach((slider) => {
    slider.addEventListener(
      "input",
      () => {
        updatePointsDisplay();
      },
      { signal }
    );
  });

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest(".remove-note");
      if (!button) {
        return;
      }
      const section = button.closest(".note-section");
      if (section) {
        section.remove();
      }
    },
    { signal }
  );

  addNoteBtn.addEventListener(
    "click",
    () => {
      const title = noteSelect.value;
      if (!title || !notesScroll) {
        return;
      }
      const exists = Array.from(notesScroll.querySelectorAll(".note-section"))
        .some((section) => section.dataset.noteTitle === title);
      if (exists) {
        return;
      }
      const nextSection = createNoteSection(title, "");
      notesScroll.appendChild(nextSection);
      resizeNoteTextareas();
    },
    { signal }
  );

  notesScroll.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (target && target.matches("textarea")) {
        target.style.height = "auto";
        target.style.height = `${target.scrollHeight}px`;
      }
    },
    { signal }
  );

  if (!defaultsSnapshot) {
    defaultsSnapshot = getState();
  }
  resizeNoteTextareas();
  updatePointsDisplay();

  return () => controller.abort();
}
