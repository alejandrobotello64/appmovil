#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CYAN = [0, 191, 255];
const NAVY = [59, 70, 165];
const INK = [35, 38, 48];
const MUTED = [95, 100, 112];
const LINE = [210, 216, 236];
const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

function fileDataUrl(rel, mime) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const b64 = fs.readFileSync(abs).toString("base64");
  return { dataUrl: `data:${mime};base64,${b64}`, format: mime.includes("png") ? "PNG" : "JPEG" };
}

function wrap(doc, text, width) {
  return doc.splitTextToSize(text, width);
}

function ensure(doc, y, need) {
  if (y + need < PAGE_H - 16) return y;
  doc.addPage();
  return 16;
}

function headingBar(doc, title, y) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7.2, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), MARGIN + 3.2, y + 4.9);
  return y + 11;
}

function sectionTitle(doc, text, y) {
  y = ensure(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text(text, MARGIN, y);
  doc.setDrawColor(...CYAN);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 1.6, MARGIN + 28, y + 1.6);
  return y + 7;
}

function body(doc, text, y, { size = 9, color = INK, leading = 4.2 } = {}) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = wrap(doc, text, CONTENT_W);
  for (const line of lines) {
    y = ensure(doc, y, leading + 2);
    doc.text(line, MARGIN, y);
    y += leading;
  }
  return y;
}

function bullet(doc, text, y, indent = 4) {
  const maxW = CONTENT_W - indent - 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const lines = wrap(doc, text, maxW);
  y = ensure(doc, y, 5);
  doc.setFillColor(...CYAN);
  doc.circle(MARGIN + indent - 1.2, y - 1.1, 0.85, "F");
  doc.text(lines[0], MARGIN + indent + 1.5, y);
  y += 4.1;
  for (const line of lines.slice(1)) {
    y = ensure(doc, y, 5);
    doc.text(line, MARGIN + indent + 1.5, y);
    y += 4.1;
  }
  return y;
}

function stepBox(doc, num, title, where, text, y) {
  const pad = 3.2;
  const innerW = CONTENT_W - 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const whereLines = wrap(doc, `En MAS: ${where}`, innerW);
  const bodyLines = wrap(doc, text, innerW);
  const h = 7 + whereLines.length * 3.5 + bodyLines.length * 3.7 + pad;
  y = ensure(doc, y, h + 2);
  doc.setFillColor(247, 249, 255);
  doc.setDrawColor(...LINE);
  doc.roundedRect(MARGIN, y, CONTENT_W, h, 1.6, 1.6, "FD");
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN + 2.2, y + 2.2, 9.5, 6.4, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(String(num), MARGIN + 7, y + 6.5, { align: "center" });
  doc.setTextColor(...NAVY);
  doc.setFontSize(9.5);
  doc.text(title, MARGIN + 14, y + 6.4);
  let ty = y + 11.2;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(0, 140, 200);
  for (const line of whereLines) {
    doc.text(line, MARGIN + 14, ty);
    ty += 3.5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  for (const line of bodyLines) {
    doc.text(line, MARGIN + 14, ty);
    ty += 3.7;
  }
  return y + h + 2.6;
}

function table(doc, headers, rows, colWidths, y) {
  const rowH = 6.2;
  const headH = 7;
  y = ensure(doc, y, headH + rowH * Math.min(rows.length, 3) + 4);
  let x = MARGIN;
  doc.setFillColor(...NAVY);
  doc.rect(MARGIN, y, CONTENT_W, headH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  x = MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 1.6, y + 4.7);
    x += colWidths[i];
  }
  y += headH;
  rows.forEach((row, idx) => {
    y = ensure(doc, y, rowH + 1);
    if (idx % 2 === 0) {
      doc.setFillColor(245, 247, 252);
      doc.rect(MARGIN, y, CONTENT_W, rowH, "F");
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...INK);
    x = MARGIN;
    for (let i = 0; i < row.length; i++) {
      const cell = wrap(doc, String(row[i]), colWidths[i] - 2.4)[0] ?? "";
      doc.text(cell, x + 1.6, y + 4.3);
      x += colWidths[i];
    }
    y += rowH;
  });
  return y + 3;
}

function flowChips(doc, labels, y) {
  const gap = 2.2;
  const h = 8;
  const needed = labels.reduce((sum, label) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    return sum + doc.getTextWidth(label) + 8 + gap + 4;
  }, 0);
  y = ensure(doc, y, h + 8);
  let x = MARGIN;
  let rowY = y;
  labels.forEach((label, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    const w = doc.getTextWidth(label) + 8;
    if (x + w > PAGE_W - MARGIN) {
      x = MARGIN;
      rowY += h + 6;
    }
    doc.setFillColor(i === labels.length - 1 ? 16 : 59, i === labels.length - 1 ? 160 : 70, i === labels.length - 1 ? 90 : 165);
    doc.roundedRect(x, rowY, w, h, 1.4, 1.4, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + 4, rowY + 5.3);
    x += w + gap;
    if (i < labels.length - 1) {
      doc.setFillColor(...CYAN);
      doc.triangle(x, rowY + 2.2, x, rowY + 5.8, x + 2.4, rowY + 4, "F");
      x += 4.2;
    }
  });
  return rowY + h + 5;
}

function drawHeader(doc, logo, iso) {
  const pageW = PAGE_W;
  doc.setFillColor(...CYAN);
  doc.rect(0, 0, pageW, 4, "F");
  doc.setFillColor(...NAVY);
  doc.rect(0, 4, pageW, 2, "F");
  const top = 10;
  const blockH = 25;
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, MARGIN, top + 1, 22, 22);
    } catch {
      /* ignore */
    }
    doc.setDrawColor(222, 226, 240);
    doc.line(MARGIN + 24, top + 1, MARGIN + 24, top + blockH - 1);
  }
  let isoW = 0;
  if (iso) {
    try {
      const props = doc.getImageProperties(iso.dataUrl);
      const ratio = props.width && props.height ? props.width / props.height : 1;
      isoW = 21 * ratio;
      doc.addImage(iso.dataUrl, iso.format, pageW - MARGIN - isoW, top + 2, isoW, 21);
    } catch {
      isoW = 0;
    }
  }
  const textX = MARGIN + 26;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("MEDICAL ADVANCED SUPPLIES", textX, top + 5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 150, 210);
  doc.text("Soluciones médicas y servicio técnico especializado", textX, top + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("RFC:", textX, top + 13.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("MAS101012CC9", textX + 10, top + 13.4);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Domicilio:", textX, top + 17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("Av. Gregorio Méndez No. 3303 Int. 5, Col. Tamulte", textX + 17, top + 17);
  doc.text("C.P. 86150, Villahermosa, Tabasco", textX + 17, top + 20.2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Tel.", textX, top + 23.6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text("993 151 8921   ·   masservice.lcs@gmail.com", textX + 8, top + 23.6);

  const infoW = 42;
  const infoX = pageW - MARGIN - isoW - (isoW ? 3 : 0) - infoW;
  doc.setFillColor(243, 245, 251);
  doc.setDrawColor(210, 216, 236);
  doc.roundedRect(infoX, top, infoW, blockH, 1.5, 1.5, "FD");
  doc.setFillColor(...NAVY);
  doc.rect(infoX, top + 1.5, 1.2, blockH - 3, "F");
  const cx = infoX + infoW / 2 + 0.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 110);
  doc.text("DOCUMENTO", cx, top + 6.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("PR-ARR-01", cx, top + 12.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text("ISO 9001:2015 · Cód. SV-EC-23", cx, top + 17, { align: "center" });
  doc.text("Proceso operativo", cx, top + 21, { align: "center" });

  return headingBar(
    doc,
    "Arrendamiento y surtido periódico · Máquina de anestesia",
    top + blockH + 3
  );
}

function drawFooters(doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Medical Advanced Supplies · ISO 9001:2015 · Cód. SV-EC-23 · PR-ARR-01",
      MARGIN,
      PAGE_H - 8
    );
    doc.text(`Página ${i} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
    doc.setFontSize(6.4);
    doc.setTextColor(140, 140, 140);
    doc.text(
      "MEDICAL ADVANCED SUPPLIES · RFC MAS101012CC9 · Av. Gregorio Méndez No. 3303 Int. 5, Villahermosa, Tabasco · Tel. 993 151 8921",
      PAGE_W / 2,
      PAGE_H - 4.5,
      { align: "center" }
    );
  }
}

const logo = fileDataUrl("public/assets/logo.png", "image/png");
const iso = fileDataUrl("public/assets/iso-9001-2015-atr.jpg", "image/jpeg");

const doc = new jsPDF({ unit: "mm", format: "a4" });
let y = drawHeader(doc, logo, iso);

y = body(
  doc,
  "Este documento describe cómo operar en MAS un equipo de anestesia que MAS pone en el hospital bajo arrendamiento, y que hay que surtir de manera periódica (mensual y/o anual). El equipo queda instalado en el cliente; el material de consumo sale del almacén con folio y kardex.",
  y
);
y += 1;
y = flowChips(
  doc,
  [
    "Contrato",
    "Equipo en cliente",
    "Kit en inventario",
    "OS / calendario",
    "Surtimiento",
    "Salida",
    "Entrega",
  ],
  y
);

y = sectionTitle(doc, "1. Qué cubre el caso", y);
y = bullet(
  doc,
  "El bien: máquina de anestesia (y, si aplica, vaporizador o monitor ligado) propiedad de MAS, instalada en quirófano del hospital.",
  y
);
y = bullet(
  doc,
  "El contrato: arrendamiento con vigencia, renta y obligaciones de mantenimiento y surtido. Se da de alta en Licitaciones → Contratos y se vincula al equipo del cliente.",
  y
);
y = bullet(
  doc,
  "El surtido: no es una venta suelta. Es un kit pactado que se entrega cada mes (consumo) y/o cada año (preventivo mayor, piezas de desgaste y verificación).",
  y
);
y = bullet(
  doc,
  "Quién interviene: Ventas/Contratos, Clientes, Biomédica, Almacén y, si falta material, Compras.",
  y
);

y = sectionTitle(doc, "2. Alta inicial (una sola vez)", y);
y = stepBox(
  doc,
  1,
  "Cliente y sitio",
  "Clientes → ficha del hospital",
  "Alta del hospital, contactos (biomédica, quirófano, compras) y ubicación exacta (torre, piso, quirófano). Sin ficha no hay equipo instalado ni OS ligada.",
  y
);
y = stepBox(
  doc,
  2,
  "Contrato de arrendamiento",
  "Licitaciones → Contratos",
  "Número de contrato, título «Arrendamiento máquina de anestesia», vigencia (inicio/fin), cliente y notas del kit pactado (mensual / anual). El equipo instalado se marca con ese contrato vigente.",
  y
);
y = stepBox(
  doc,
  3,
  "Equipo en el cliente",
  "Clientes → Equipos instalados",
  "Nombre, marca, modelo, serie, estado Operativo, fecha de instalación y contrato. Si hay vaporizador o monitor, se ligan como equipo relacionado (máquina de anestesia / vaporizador).",
  y
);
y = stepBox(
  doc,
  4,
  "Modelo en inventario MAS",
  "Almacén → Inventario (categoría Equipos)",
  "El catálogo es por modelo. La serie de la pieza que sale a renta se captura en Entradas al dar de alta la unidad y se descuenta del almacén al instalar (Salida o surtimiento de instalación).",
  y
);
y = stepBox(
  doc,
  5,
  "Kit de consumo en catálogo",
  "Almacén → Inventario (insumos, accesorios, refacciones)",
  "Cada línea del kit debe existir como artículo (SKU). Así el surtido periódico no depende de elegir categoría: se busca en la lista unificada y se arma la solicitud.",
  y
);
y = stepBox(
  doc,
  6,
  "Calendario de visitas",
  "Calendario + Órdenes de servicio",
  "Programar la visita mensual de surtido y la anual de preventivo sobre ese equipo. El recordatorio abre la OS del periodo; no se surte «de memoria».",
  y
);

doc.addPage();
y = 16;
y = sectionTitle(doc, "3. Ciclo mensual (surtido de consumo)", y);
y = body(
  doc,
  "Cada mes (o según la periodicidad del contrato) se abre una orden de servicio ligada al mismo equipo y contrato. Biomédica pide el kit; Almacén lo surte; si falta algo, se genera solicitud de compra. La entrega queda firmada y el kardex conserva el folio de salida.",
  y
);
y += 1;
y = stepBox(
  doc,
  "A",
  "Abrir la OS del periodo",
  "Órdenes de servicio → nueva OS (mantenimiento / surtimiento)",
  "Cliente, equipo de anestesia, contrato, técnico y fecha. En notas: «Surtido mensual contrato [número] — quirófano X».",
  y
);
y = stepBox(
  doc,
  "B",
  "Pedir el kit a almacén",
  "Desde la OS → solicitud de surtimiento",
  "Cargar las líneas del kit mensual (cantidades pactadas). Folio tipo SOL-OS. Almacén ve la bandeja en Almacén → Surtimientos.",
  y
);
y = stepBox(
  doc,
  "C",
  "Surtir o comprar",
  "Almacén → Surtimientos (y Compras si falta)",
  "Si hay existencia: se surte y se descuenta del almacén (almacenes con stock, lote y caducidad cuando aplique). Si no alcanza: Solicitar compra (SC-). Compras arma el pedido; al recibir (Entrada EM-) se termina el surtido pendiente.",
  y
);
y = stepBox(
  doc,
  "D",
  "Entregar en el hospital",
  "Salida / PDF de surtimiento + visita",
  "Motivo de salida: servicio técnico o consumo del contrato. Se entrega en sitio, se firma el PDF de surtimiento (almacén y receptor del hospital) y se cierra la OS del mes. El historial queda en Kardex (SAL-).",
  y
);

y = sectionTitle(doc, "Kit mensual típico (ejemplo de contrato)", y);
y = body(
  doc,
  "Las cantidades se fijan en el contrato. Esta tabla es un ejemplo de estación de anestesia en quirófano; se ajusta por consumo real a los 90 días.",
  y,
  { size: 8.5, color: MUTED }
);
y = table(
  doc,
  ["SKU / tipo", "Artículo", "Cant./mes", "Notas"],
  [
    ["Insumo", "Cal sodada (absorbente CO₂)", "1–2 envases", "Caducidad y lote obligatorios"],
    ["Accesorio", "Circuito paciente adulto", "4–8 pzas", "Según número de cirugías"],
    ["Accesorio", "Filtro HME / bacteriano", "8–20 pzas", "Unidad por paciente"],
    ["Accesorio", "Bolsa reservorio", "2 pzas", "Reposición por desgaste"],
    ["Insumo", "Sensor / cinta SpO₂ desechable", "según pacto", "Si el contrato lo incluye"],
    ["Accesorio", "Filtro de gas / línea de muestreo", "2–4 pzas", "Analizador de gases"],
  ],
  [28, 62, 32, 60],
  y
);

y = sectionTitle(doc, "4. Ciclo anual (preventivo y recambio)", y);
y = body(
  doc,
  "Una vez al año (o en el mes pactado) se hace mantenimiento preventivo mayor sobre la misma máquina, sin darla de baja del cliente. El surtido anual es de refacciones de desgaste y verificación, no el kit diario de quirófano.",
  y
);
y += 1;
y = stepBox(
  doc,
  "E",
  "OS de preventivo anual",
  "Órdenes de servicio + Plantillas de checklist",
  "Tipo mantenimiento, equipo y contrato. Se usa la plantilla de máquina de anestesia (verificación, fugas, vaporizador, ventilación). Fotos de antes/después en la OS.",
  y
);
y = stepBox(
  doc,
  "F",
  "Kit anual y refacciones",
  "Surtimientos + Inventario (refacciones)",
  "Fuelle/diafragma, filtros de máquina, kit de preventivo del fabricante, piezas de desgaste. Misma bandeja de surtimiento; si no hay, Compras. Se registra salida hacia el sitio.",
  y
);
y = stepBox(
  doc,
  "G",
  "Cerrar y reprogramar",
  "OS + Clientes (historial) + Calendario",
  "Se actualiza el próximo servicio en la ficha, se deja constancia en el historial del equipo y se agenda el siguiente año. Capacitación breve al personal de quirófano si el contrato lo pide (Educación / visita).",
  y
);

y = table(
  doc,
  ["Periodicidad", "Qué se entrega / hace", "Módulo MAS", "Folio típico"],
  [
    ["Alta / instalación", "Máquina + accesorios de arranque", "Inventario, Entrada, Salida, Cliente", "EM- / SAL- / OS-"],
    ["Mensual", "Kit de consumo de quirófano", "OS → Surtimientos → Salida", "SOL-OS / SAL-"],
    ["Cuando falta stock", "Reposición de compra", "Solicitar compra → Pedido → Entrada", "SC- / EM-"],
    ["Anual", "Preventivo mayor + refacciones", "OS + checklist + Surtimientos", "OS- / SAL-"],
    ["Correctivo", "Falla en sitio o préstamo de equipo", "OS reparación; Movimientos si hay cambio", "OS- / TR- / SAL-"],
  ],
  [32, 58, 58, 34],
  y
);

doc.addPage();
y = 16;
y = sectionTitle(doc, "5. Si no hay existencias", y);
y = bullet(
  doc,
  "Almacén no inventa el artículo: lo busca en Inventario (una sola lista). Si el SKU no existe, primero se da de alta el artículo y después el surtido.",
  y
);
y = bullet(
  doc,
  "En la solicitud, lo pendiente pasa a Compras (SC-). El surtimiento queda abierto hasta la recepción (Entrada). No se cierra la OS mensual sin el material crítico (cal sodada, circuitos).",
  y
);
y = bullet(
  doc,
  "Apartados: si el kit del mes siguiente ya está en almacén, se puede apartar para ese contrato/proyecto y no mezclarlo con otra OS.",
  y
);

y = sectionTitle(doc, "6. Roles", y);
y = table(
  doc,
  ["Rol", "Hace", "Módulo"],
  [
    ["Ventas / contratos", "Vigencia, kit pactado, cobro de renta", "Licitaciones → Contratos"],
    ["Clientes", "Ficha, equipo instalado, contactos", "Clientes"],
    ["Técnico / biomédica", "OS, checklist, entrega en sitio", "Órdenes de servicio, Calendario"],
    ["Almacén", "Surtir, salida, lotes/caducidad, kardex", "Inventario, Surtimientos, Salidas"],
    ["Compras", "SC- y recepción cuando no hay stock", "Compras"],
  ],
  [42, 88, 52],
  y
);

y = sectionTitle(doc, "7. Reglas que no se saltan", y);
y = bullet(
  doc,
  "La máquina arrendada no se «edita a mano» el stock: entra y sale con movimientos (EM-, SAL-, TR-).",
  y
);
y = bullet(
  doc,
  "Toda visita periódica nace de una OS ligada al equipo y al contrato. Así se ve el historial en la ficha del cliente y en el kardex.",
  y
);
y = bullet(
  doc,
  "Insumos con caducidad (cal sodada) llevan lote; almacén solo ofrece almacenes con existencia de ese artículo.",
  y
);
y = bullet(
  doc,
  "Si se sustituye la máquina (préstamo o canje), se actualiza la serie en Clientes y se registra el movimiento; el contrato sigue siendo el mismo.",
  y
);
y = bullet(
  doc,
  "Al vencer el arrendamiento: OS de retiro, entrada de devolución al almacén, equipo del cliente a Baja o reinstalación en otro sitio.",
  y
);

y = sectionTitle(doc, "8. Resumen en una frase", y);
y = body(
  doc,
  "Contrato de arrendamiento + equipo instalado en el cliente + kit en inventario + OS periódica + surtimiento/salida. Mensual = consumo de quirófano. Anual = preventivo y refacciones. Si no hay stock, Compras; nada se mueve sin folio.",
  y
);

y += 4;
y = ensure(doc, y, 28);
doc.setFillColor(237, 248, 255);
doc.setDrawColor(...CYAN);
doc.roundedRect(MARGIN, y, CONTENT_W, 22, 1.8, 1.8, "FD");
doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(...NAVY);
doc.text("Cómo usarlo mañana en MAS", MARGIN + 4, y + 6);
doc.setFont("helvetica", "normal");
doc.setFontSize(8.4);
doc.setTextColor(...INK);
const nextLines = wrap(
  doc,
  "1) Contratos: alta ARR-ANEST-…  2) Clientes: máquina + serie + quirófano  3) Inventario: SKUs del kit  4) Calendario: visita del mes  5) OS → Surtimientos → Salida. El mismo camino, cada mes y cada año.",
  CONTENT_W - 8
);
let ny = y + 11;
for (const line of nextLines) {
  doc.text(line, MARGIN + 4, ny);
  ny += 3.8;
}

drawFooters(doc);

const outDir = path.join(ROOT, "docs");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "proceso-arrendamiento-anestesia.pdf");
const bytes = doc.output("arraybuffer");
fs.writeFileSync(outFile, Buffer.from(bytes));

const artifacts = "/opt/cursor/artifacts";
if (fs.existsSync("/opt/cursor")) {
  fs.mkdirSync(artifacts, { recursive: true });
  fs.copyFileSync(outFile, path.join(artifacts, "proceso-arrendamiento-anestesia.pdf"));
}

console.log("Wrote", outFile);
