/**
 * Power 4 conference schools (ACC, Big Ten, Big 12, SEC) as they appear in NBA bio data.
 * Used to bias outer-shell college criteria toward major programs.
 */
export const POWER4_SCHOOLS: ReadonlySet<string> = new Set([
  // ACC
  "Boston College",
  "Clemson",
  "Duke",
  "Florida State",
  "Georgia Tech",
  "Louisville",
  "Miami (FL)",
  "North Carolina",
  "North Carolina State",
  "Notre Dame",
  "Pittsburgh",
  "Syracuse",
  "Virginia",
  "Virginia Tech",
  "Wake Forest",

  // Big Ten
  "Illinois",
  "Indiana",
  "Iowa",
  "Maryland",
  "Michigan",
  "Michigan State",
  "Minnesota",
  "Nebraska",
  "Northwestern",
  "Ohio State",
  "Penn State",
  "Purdue",
  "Rutgers",
  "Wisconsin",
  "California-Los Angeles",
  "Southern California",
  "Oregon",
  "Washington",

  // Big 12
  "Arizona",
  "Arizona State",
  "Baylor",
  "Brigham Young",
  "Cincinnati",
  "Colorado",
  "Houston",
  "Iowa State",
  "Kansas",
  "Kansas State",
  "Oklahoma",
  "Oklahoma State",
  "TCU",
  "Texas",
  "Texas A&M",
  "Texas Tech",
  "UCF",
  "Utah",
  "West Virginia",

  // SEC
  "Alabama",
  "Arkansas",
  "Auburn",
  "Florida",
  "Georgia",
  "Kentucky",
  "Louisiana State",
  "Mississippi",
  "Mississippi State",
  "Missouri",
  "South Carolina",
  "Tennessee",
  "Vanderbilt",
]);

export function isPower4School(school: string): boolean {
  return POWER4_SCHOOLS.has(school);
}
