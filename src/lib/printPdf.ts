export async function printPDF(url: string, token: string): Promise<void> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to fetch PDF');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const win = window.open(objectUrl);
  if (win) {
    win.onload = () => {
      win.print();
      // revoke after a delay to allow print dialog to open
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    };
  } else {
    // popup blocked — fallback: just open the PDF so user can print manually
    window.location.href = objectUrl;
  }
}
