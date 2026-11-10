// FILE: modules/exporter.js
export function leadsToCSV(leads) {
  const headers = [
    'Empresa','Categoria','Telefone','Email','WhatsApp','Site','Instagram',
    'Seguidores Instagram','Conta de origem','Cidade','Estado','Nota','Avaliações','Qualificação 1-5',
    'Confiança','Dor principal','Oportunidade','Abordagem recomendada',
    'Mensagem','Status Mensagem','Status Comercial',
    'Observação','Data do Contato','Follow-up'
  ];
  const escape = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\n\r;]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const l of leads) {
    lines.push([
      l.nome || '', l.categoria || '', l.telefone || '', l.email || '', l.whatsapp || '',
      l.site || '', l.instagram || '', l.instagramFollowers || '',
      (l.seedInstagrams || [l.seedInstagram]).filter(Boolean).join(' | '), l.cidade || '', l.estado || '',
      l.nota == null ? '' : l.nota, l.avaliacoes == null ? '' : l.avaliacoes,
      l.score == null ? '' : l.score,
      l.qualificationConfidence || '', l.primaryPain || '', l.opportunity || '',
      l.recommendedApproach || '',
      l.messageText || '', l.messageStatus || '', l.salesStatus || '',
      l.internalNote || '', l.contactDate || '', l.followUpDate || ''
    ].map(escape).join(','));
  }
  return lines.join('\r\n');
}

export function leadsToJSON(leads) {
  return JSON.stringify(leads, null, 2);
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
