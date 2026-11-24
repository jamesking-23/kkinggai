import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { safeLink } from "./news";
import { ScreenHeader } from "./ScreenHeader";
import { supabase } from "./supabase";
import { C } from "./theme";
import {
  checkItem,
  filterVault,
  kindText,
  sizeText,
  type VaultFilter,
  type VaultRow,
} from "./vault";

/** Native vault: private notes, links and files. Add notes and links, search, read, open links, and open files through a short-lived signed link. Uploading files, editing and deleting stay on the website. Not end-to-end encrypted. */
export function VaultScreen({ onBack, onOpenWeb }: { onBack: () => void; onOpenWeb: () => void }) {
  const [items, setItems] = useState<VaultRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState<VaultFilter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<"note" | "link" | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");

  const load = useCallback(async () => {
    setFailed(false);
    const r = await supabase
      .from("vault_items")
      .select("id, kind, title, body, url, category, tags, storage_path, size_bytes, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .overrideTypes<VaultRow[], { merge: false }>();
    if (r.error) return setFailed(true);
    setItems(r.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => filterVault(items ?? [], kind, query), [items, kind, query]);

  async function save() {
    if (!adding || saving) return;
    const v = checkItem(adding, title, body, url, category, tags);
    if (typeof v === "string") return setProblem(v);
    setSaving(true);
    setProblem(null);
    const { error } = await supabase.from("vault_items").insert(v);
    setSaving(false);
    if (error) return setProblem("Could not save. Try again.");
    setTitle("");
    setBody("");
    setUrl("");
    setCategory("");
    setTags("");
    setAdding(null);
    load();
  }

  async function openLink(raw: string | null) {
    const u = safeLink(raw);
    if (!u) return setProblem("This link cannot be opened.");
    try {
      await Linking.openURL(u);
    } catch {
      setProblem("Could not open the link.");
    }
  }

  async function openFile(path: string | null) {
    if (!path) return;
    setProblem(null);
    const { data, error } = await supabase.storage.from("vault").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return setProblem("Could not open the file.");
    openLink(data.signedUrl);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Vault" onBack={onBack} action={{ label: "More", onPress: onOpenWeb }} />
      <ScrollView
        contentContainerStyle={s.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Text style={s.notice}>
          Private to you. Encrypted at rest by the database provider, but not end-to-end encrypted.
          Do not store passwords, recovery codes or card numbers here.
        </Text>

        {adding ? (
          <View style={s.card}>
            <Text style={s.meta}>New {adding}</Text>
            <TextInput
              style={[s.input, { marginTop: 8 }]}
              placeholder="Title"
              placeholderTextColor={C.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
            />
            {adding === "link" && (
              <TextInput
                style={s.input}
                placeholder="https://"
                placeholderTextColor={C.muted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            )}
            <TextInput
              style={[s.input, { minHeight: 90, textAlignVertical: "top" }]}
              placeholder={adding === "note" ? "Note" : "Notes (optional)"}
              placeholderTextColor={C.muted}
              value={body}
              onChangeText={setBody}
              multiline
            />
            <TextInput
              style={s.input}
              placeholder="Category (optional)"
              placeholderTextColor={C.muted}
              value={category}
              onChangeText={setCategory}
            />
            <TextInput
              style={s.input}
              placeholder="Tags, comma separated"
              placeholderTextColor={C.muted}
              value={tags}
              onChangeText={setTags}
              autoCapitalize="none"
            />
            <View style={s.row}>
              <Pressable
                style={[s.btn, saving && { opacity: 0.5 }]}
                disabled={saving}
                onPress={save}
              >
                <Text style={s.btnText}>Save</Text>
              </Pressable>
              <Pressable style={s.ghost} onPress={() => setAdding(null)}>
                <Text style={s.ghostText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={s.row}>
            <Pressable
              style={s.addBtn}
              onPress={() => {
                setProblem(null);
                setAdding("note");
              }}
            >
              <Text style={s.btnText}>+ Note</Text>
            </Pressable>
            <Pressable
              style={s.addBtn}
              onPress={() => {
                setProblem(null);
                setAdding("link");
              }}
            >
              <Text style={s.btnText}>+ Link</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
        >
          {(["all", "note", "link", "file"] as const).map((k) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[s.chip, kind === k && s.chipOn]}>
              <Text style={[s.chipText, kind === k && s.chipTextOn]}>
                {k === "all" ? "All" : `${kindText(k)}s`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput
          style={s.input}
          placeholder="Search title, category or tag"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />

        {problem && <Text style={s.error}>{problem}</Text>}
        {failed && <Text style={s.error}>Could not load. Pull down to retry.</Text>}
        {items === null && !failed && <ActivityIndicator color={C.primary} />}
        {items && shown.length === 0 && (
          <Text style={s.muted}>
            {items.length === 0 ? "The vault is empty." : "Nothing matches."}
          </Text>
        )}

        {shown.map((i) => (
          <Pressable key={i.id} style={s.card} onPress={() => setOpen(open === i.id ? null : i.id)}>
            <Text style={s.title}>{i.title}</Text>
            <Text style={s.meta}>
              {[kindText(i.kind), i.category, sizeText(i.size_bytes), ...i.tags.map((t) => `#${t}`)]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {open === i.id && (
              <View>
                {!!i.body && <Text style={s.body}>{i.body}</Text>}
                {i.kind === "link" && (
                  <Pressable style={[s.ghost, { marginTop: 10 }]} onPress={() => openLink(i.url)}>
                    <Text style={s.ghostText}>Open link</Text>
                  </Pressable>
                )}
                {i.kind === "file" && (
                  <Pressable
                    style={[s.ghost, { marginTop: 10 }]}
                    onPress={() => openFile(i.storage_path)}
                  >
                    <Text style={s.ghostText}>Open file</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        ))}
        {items && items.length >= 500 && <Text style={s.muted}>Showing the 500 newest items.</Text>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 32 },
  notice: {
    color: C.muted,
    fontSize: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  chips: { gap: 8, paddingBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 13 },
  chipTextOn: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    color: C.text,
  },
  addBtn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "700" },
  ghost: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  ghostText: { color: C.primary, fontWeight: "600", fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  error: { color: C.danger, marginBottom: 8 },
  muted: { color: C.muted, marginTop: 8 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: C.text, fontWeight: "700", fontSize: 15 },
  meta: { color: C.muted, fontSize: 12, marginTop: 4 },
  body: { color: C.text, marginTop: 10, lineHeight: 20 },
});
