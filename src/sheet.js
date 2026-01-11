export function initSheet() {
  const portraitInput = document.getElementById("portraitInput");
  const portraitPreview = document.getElementById("portraitPreview");
  const portraitPlaceholder = document.getElementById("portraitPlaceholder");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const noteSelect = document.getElementById("noteSelect");

  if (
    !portraitInput ||
    !portraitPreview ||
    !portraitPlaceholder ||
    !importBtn ||
    !exportBtn ||
    !importFile ||
    !addNoteBtn ||
    !noteSelect
  ) {
    return () => {};
  }

  const controller = new AbortController();
  const { signal } = controller;
  let portraitData = "";

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
      const scroll = document.getElementById("notesScroll");
      if (!title || !scroll) {
        return;
      }
      const exists = Array.from(scroll.querySelectorAll(".note-section"))
        .some((section) => section.dataset.noteTitle === title);
      if (exists) {
        return;
      }
      scroll.appendChild(createNoteSection(title, ""));
    },
    { signal }
  );

  const sectionByName = (name) => {
    return document.querySelector(`[data-section=\"${name}\"]`);
  };

  const getDotRows = (section) => {
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
          <button type="button" class="remove-note">Remove</button>
        </div>
        <textarea aria-label="${title} notes"></textarea>
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

  const getSliders = (section, selector) => {
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
    if (!data) {
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
    const result = {};
    section.querySelectorAll(selector).forEach((label) => {
      const text = label.textContent.trim();
      const input = label.querySelector("input[type=\"checkbox\"]");
      result[text] = input ? input.checked : false;
    });
    return result;
  };

  const setChecks = (section, selector, data) => {
    if (!data) {
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

  const diffObject = (current, base) => {
    const out = {};
    Object.keys(current).forEach((key) => {
      const currentValue = current[key];
      const baseValue = base ? base[key] : undefined;
      if (Array.isArray(currentValue)) {
        if (JSON.stringify(currentValue) !== JSON.stringify(baseValue || [])) {
          out[key] = currentValue;
        }
      } else if (currentValue && typeof currentValue === "object") {
        const nested = diffObject(currentValue, baseValue || {});
        if (Object.keys(nested).length) {
          out[key] = nested;
        }
      } else if (currentValue !== baseValue) {
        out[key] = currentValue;
      }
    });
    return out;
  };

  const defaults = getState();

  exportBtn.addEventListener(
    "click",
    () => {
      const current = getState();
      const diff = diffObject(current, defaults);
      const payload = {
        version: 2,
        ...diff
      };
      if (portraitData) {
        payload.portrait = portraitData;
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "character-sheet.json";
      link.click();
      URL.revokeObjectURL(url);
    },
    { signal }
  );

  importBtn.addEventListener(
    "click",
    () => {
      importFile.click();
    },
    { signal }
  );

  importFile.addEventListener(
    "change",
    () => {
      const file = importFile.files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (Array.isArray(data.fields)) {
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
          }
          if (data.portrait) {
            portraitData = data.portrait;
            portraitPreview.src = portraitData;
            portraitPlaceholder.style.display = "none";
          }
        } catch (err) {
          console.error("Invalid import file", err);
        }
      };
      reader.readAsText(file);
      importFile.value = "";
    },
    { signal }
  );

  return () => controller.abort();
}
