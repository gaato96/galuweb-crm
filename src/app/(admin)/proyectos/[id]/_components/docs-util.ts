import type { DocumentoProyecto } from "@/lib/types";

/** Inserta o reemplaza un documento por id, dejándolo primero en la lista. */
export function upsertDoc(docs: DocumentoProyecto[], doc: Omit<DocumentoProyecto, "updated_at">): DocumentoProyecto[] {
    const nuevo: DocumentoProyecto = { ...doc, updated_at: new Date().toISOString() };
    return [nuevo, ...docs.filter((d) => d.id !== doc.id)];
}

export function nombreArchivoMd(titulo: string): string {
    const base = titulo
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `${base || "documento"}.md`;
}
