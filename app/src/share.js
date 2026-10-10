// Saves a file and opens the phone's share menu (save to Files / Drive, email, Messenger...).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { T } from './content';

const KINDS = {
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' },
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'org.openxmlformats.spreadsheetml.sheet' },
};

// content: text (csv) or bytes (xlsx, a Uint8Array)
async function shareFile(name, content, kind, dialogTitle) {
  if (!(await Sharing.isAvailableAsync())) throw new Error(T.history.noShare);
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, { ...KINDS[kind], dialogTitle });
}

export const shareCsv = (name, text, dialogTitle) => shareFile(name, text, 'csv', dialogTitle);
export const shareXlsx = (name, bytes, dialogTitle) => shareFile(name, bytes, 'xlsx', dialogTitle);
