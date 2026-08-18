import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'doctorName',
  standalone: true,
})
export class DoctorNamePipe implements PipeTransform {
  /**
   * Transform a doctor's name into "Dr. FirstName LastName" format.
   * - If the name already starts with "Dr. " (case-insensitive), return as-is.
   * - If the name is null/undefined/empty, return an empty string.
   * - Otherwise, prefix with "Dr. ".
   */
  transform(name: string | null | undefined): string {
    if (!name) {
      return '';
    }

    const trimmed = name.trim();

    // Avoid producing "Dr. Dr. ..." if the prefix already exists
    if (trimmed.toLowerCase().startsWith('dr.')) {
      return trimmed;
    }

    // Assume format "FirstName LastName" and prefix with "Dr. "
    return `Dr. ${trimmed}`;
  }
}