export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  
  // Flatten logic for nested objects
  const flatten = (obj: any, prefix = '') => {
    let result: any = {};
    for (const key in obj) {
      const name = prefix ? `${prefix}_${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flatten(obj[key], name));
      } else if (Array.isArray(obj[key])) {
        result[name] = obj[key].join('; ');
      } else {
        result[name] = obj[key];
      }
    }
    return result;
  };

  const flattenedData = data.map(item => flatten(item));
  const headers = Object.keys(flattenedData[0]).join(',');
  const rows = flattenedData.map(obj => 
    Object.keys(flattenedData[0]).map(header => {
      const val = obj[header];
      return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : (val === null || val === undefined ? '' : val);
    }).join(',')
  ).join('\n');

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + "\n" + rows;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportListingsToCSV(listings: any[]) {
  if (listings.length === 0) return;
  const headers = ["Name", "Address", "Website", "Phone", "Email", "Category", "Status", "Lead Score"];
  const rows = listings.map(l => [
    l.name, l.address, l.website || "", l.phone || "", l.email || "", l.category, l.status, l.leadScore
  ]);
  const csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n" 
    + rows.map(e => e.join(",")).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `prospect_leads_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
