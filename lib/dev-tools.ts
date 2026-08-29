export type DevFieldKey = "title" | "title_uk" | "description" | "description_uk";

export interface DevFields {
  title: string;
  title_uk: string;
  description: string;
  description_uk: string;
}

export interface DevEditorState {
  baseline: DevFields;
  draft: DevFields;
  past: DevFields[];
  future: DevFields[];
  revision: string;
}

export type DevEditorAction =
  | { type: "edit"; key: DevFieldKey; value: string; record: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "cancel" }
  | { type: "saved"; fields: DevFields; revision: string }
  | { type: "loaded"; fields: DevFields; revision: string }
  | { type: "revision"; revision: string }
  | { type: "restored"; state: DevEditorState };

export function isDevToolsAvailable(environment: string | undefined, hostname: string) {
  return environment === "development" && hostname === "localhost";
}

export function publicPageUrl(
  publicOrigin: string,
  location: Pick<Location, "pathname" | "search" | "hash">,
  lang?: "en" | "uk"
) {
  const url = new URL(`${location.pathname}${location.search}${location.hash}`, publicOrigin);
  if (lang) {
    url.searchParams.delete("lang");
    if (lang === "uk") url.searchParams.set("lang", "uk");
  }
  return url.href;
}

export function sourceForLanguage(
  lang: "en" | "uk",
  source: string | undefined,
  sourceUk: string | undefined
) {
  return lang === "uk" && sourceUk ? sourceUk : source;
}

export function createDevEditorState(fields: DevFields, revision: string): DevEditorState {
  return { baseline: fields, draft: fields, past: [], future: [], revision };
}

export function devEditorReducer(
  state: DevEditorState,
  action: DevEditorAction
): DevEditorState {
  switch (action.type) {
    case "restored":
      return action.state;
    case "loaded":
      return createDevEditorState(action.fields, action.revision);
    case "revision":
      return { ...state, revision: action.revision };
    case "edit": {
      if (state.draft[action.key] === action.value) return state;
      return {
        ...state,
        draft: { ...state.draft, [action.key]: action.value },
        past: action.record ? [...state.past, state.draft].slice(-100) : state.past,
        future: [],
      };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        draft: previous,
        past: state.past.slice(0, -1),
        future: [state.draft, ...state.future].slice(0, 100),
      };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return {
        ...state,
        draft: next,
        past: [...state.past, state.draft].slice(-100),
        future,
      };
    }
    case "cancel":
      return { ...state, draft: state.baseline, past: [], future: [] };
    case "saved":
      return {
        baseline: action.fields,
        draft: action.fields,
        // Undo after Save prepares the previous on-disk version as a new
        // DRAFT; it never writes a reversal without another explicit Save.
        past: [state.baseline],
        future: [],
        revision: action.revision,
      };
  }
}

export function devEditorDirty(state: DevEditorState) {
  return (Object.keys(state.draft) as DevFieldKey[]).some(
    (key) => state.draft[key] !== state.baseline[key]
  );
}

export function devEditorChanges(state: DevEditorState): Partial<DevFields> {
  const changes: Partial<DevFields> = {};
  for (const key of Object.keys(state.draft) as DevFieldKey[]) {
    if (state.draft[key] !== state.baseline[key]) changes[key] = state.draft[key];
  }
  return changes;
}
