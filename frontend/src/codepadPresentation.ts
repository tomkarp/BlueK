export function codepadResultValue(value: string) {
  const separator = value.lastIndexOf(" : ");
  return separator < 0 ? value : value.slice(0, separator);
}
export function codepadResultType(value: string) {
  const separator = value.lastIndexOf(" : ");
  return separator < 0 ? "" : value.slice(separator);
}
