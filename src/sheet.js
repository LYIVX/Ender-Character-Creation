let portraitData = "";
let defaultsSnapshot = null;

const sectionByName = (name) => {
  return document.querySelector(`[data-section="${name}"]`);
};

const getDotRows = (section) => {
  if (!section) return {};
  const rows = section.querySelectorAll(".dot-row");
  const result = {};
  rows.forEach((row) => {
    const label = row.querySelector(".stat-chip")?.textContent.trim() || "Unknown";
    const count = row.querySelectorAll(".dot-input:checked").length;
    result[label] = count;
  });
  return result;
};

const setDotRows = (section, data) => {
  if (!section || !data) return;
  const rows = section.querySelectorAll(".dot-row");
  rows.forEach((row) => {
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

const applySnapshot = (data) => {
  if (!data) return;
  setIdentity(data.identity);
  if (data.notes !== undefined) {
    setNotes(data.notes);
  }
  if (data.body?.stats) {
    setDotRows(sectionByName("body"), data.body.stats);
  }
  if (data.skills?.stats) {
    setDotRows(sectionByName("skills"), data.skills.stats);
  }
  if (data.priorities?.stats) {
    setDotRows(sectionByName("priorities"), data.priorities.stats);
  }
  if (data.mind?.stats) {
    setDotRows(sectionByName("mind"), data.mind.stats);
  }
  if (data.mind?.sliders) {
    setSliders(sectionByName("mind"), ".range-row", data.mind.sliders);
  }
  if (data.mind?.traits) {
    setChecks(sectionByName("mind"), ".traits label", data.mind.traits);
  }
  if (data.social?.stats) {
    setDotRows(sectionByName("social"), data.social.stats);
  }
  if (data.social?.sliders) {
    setSliders(sectionByName("social"), ".social-slider", data.social.sliders);
  }
  if (data.social?.traits) {
    setChecks(sectionByName("social"), ".checkbox-list label", data.social.traits);
  }
  resizeNoteTextareas();
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
};

export const resetSheetToDefaults = () => {
  resetToDefaults();
  const fields = Array.from(document.querySelectorAll(".frame input, .frame textarea")).filter(
    (el) => el.type !== "file"
  );
  fields.forEach((el) => {
    if (el.type === "checkbox") {
      el.checked = el.defaultChecked;
    } else {
      const defaultValue = el.defaultValue ?? "";
      el.value = defaultValue;
    }
  });
  resizeNoteTextareas();
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
    resetToDefaults();
    return;
  }
  if (Array.isArray(data.fields)) {
    resetToDefaults();
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
    resetToDefaults();
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
          const isChecked = box.checked;
          boxes.forEach((item, i) => {
            item.checked = isChecked ? i <= index : i < index;
          });
        },
        { signal }
      );
    });
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

  return () => controller.abort();
}
