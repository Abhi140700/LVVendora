export const formatMoney = (value) => Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export const downloadRowsAsExcel = (rows, columns, filename) => {
    const header = columns.map((column) => column.label);
    const body = rows.map((row) => columns.map((column) => {
        const value = typeof column.value === "function" ? column.value(row) : row[column.value];
        return String(value ?? "").replace(/\t/g, " ").replace(/\n/g, " ");
    }));
    const tsv = [header, ...body].map((line) => line.join("\t")).join("\n");
    const blob = new Blob([tsv], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
};

export const shareReportByEmail = ({ title, summary }) => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${title}\n\n${summary}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
};

export const shareReportByWhatsApp = ({ title, summary }) => {
    const message = encodeURIComponent(`${title}\n${summary}`);
    window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
};

export const loadReportPresets = (key) => {
    try {
        return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
        return [];
    }
};

export const saveReportPreset = (key, preset) => {
    const current = loadReportPresets(key).filter((item) => item.name !== preset.name);
    const next = [preset, ...current].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(next));
    return next;
};
