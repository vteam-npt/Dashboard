// Server timestamps are UTC while drafts may include a +07:00 offset.
const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit'});
export function bangkokMonth(value) {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) return '';
 const parts = formatter.formatToParts(date);
 return `${parts.find(part=>part.type==='year').value}-${parts.find(part=>part.type==='month').value}`;
}
