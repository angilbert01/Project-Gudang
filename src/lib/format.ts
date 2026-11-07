export function formatNumber(val: number | string | null | undefined, maxDecimals = 2): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = Number(val);
  if (isNaN(num)) return "0";
  return num.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatRupiah(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === "") return "-";
  const num = Number(val);
  if (isNaN(num)) return "-";
  return (
    "Rp " +
    num.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDateId(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const s = String(dateStr).slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return String(dateStr);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeId(dtStr: string | null | undefined): string {
  if (!dtStr) return "-";
  const d = new Date(String(dtStr).includes("T") ? String(dtStr) : String(dtStr) + "Z");
  if (isNaN(d.getTime())) return String(dtStr);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayYmd(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export async function exportToCsvOrExcel(
  reportName: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  format: "CSV" | "EXCEL" = "CSV"
) {
  // Log export to server Audit Trail (FR-15)
  try {
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_name: reportName,
        format,
        row_count: rows.length,
      }),
    });
  } catch {
    // ignore logging failure
  }

  if (format === "CSV") {
    const escapeCell = (c: unknown) => {
      const str = c === null || c === undefined ? "" : String(c);
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvContent =
      "\uFEFF" +
      [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join(
        "\r\n"
      );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName.toLowerCase().replace(/\s+/g, "_")}_${todayYmd()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Generate HTML Table Excel (.xls) compatible with Microsoft Excel & LibreOffice
    const thHtml = headers
      .map(
        (h) =>
          `<th style="background-color:#1e293b;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #cbd5e1;">${h}</th>`
      )
      .join("");
    const trHtml = rows
      .map(
        (r) =>
          `<tr>${r
            .map(
              (c) =>
                `<td style="padding:6px;border:1px solid #cbd5e1;">${
                  c === null || c === undefined ? "" : String(c)
                }</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8"></head>
      <body>
        <h3>${reportName} — Dicetak: ${formatDateId(todayYmd())}</h3>
        <table border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
          <thead><tr>${thHtml}</tr></thead>
          <tbody>${trHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName.toLowerCase().replace(/\s+/g, "_")}_${todayYmd()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

