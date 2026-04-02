import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───
export interface EnamedSpecialty {
  id: string;
  name: string;
  slug: string;
}

export interface EnamedInstitution {
  id: string;
  name: string;
  uf: string;
  slug: string;
}

export interface EnamedProgram {
  id: string;
  specialty_id: string;
  institution_id: string;
  vagas: number;
  cenario_pratica: string | null;
}

export interface InstitutionWithProgram extends EnamedInstitution {
  vagas: number;
  cenario_pratica: string | null;
}

// ─── Queries ───
async function fetchSpecialties(): Promise<EnamedSpecialty[]> {
  const { data, error } = await supabase
    .from("enamed_specialties")
    .select("id, name, slug")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

async function fetchInstitutions(): Promise<EnamedInstitution[]> {
  const { data, error } = await supabase
    .from("enamed_institutions")
    .select("id, name, uf, slug")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

async function fetchPrograms(): Promise<EnamedProgram[]> {
  const { data, error } = await supabase
    .from("enamed_programs")
    .select("id, specialty_id, institution_id, vagas, cenario_pratica");
  if (error) throw error;
  return data ?? [];
}

// ─── Hooks ───
const STALE_TIME = 30 * 60 * 1000; // 30 minutes — reference data

export function useEnamedSpecialties() {
  return useQuery({
    queryKey: ["enamed-specialties"],
    queryFn: fetchSpecialties,
    staleTime: STALE_TIME,
  });
}

export function useEnamedInstitutions() {
  return useQuery({
    queryKey: ["enamed-institutions"],
    queryFn: fetchInstitutions,
    staleTime: STALE_TIME,
  });
}

export function useEnamedPrograms() {
  return useQuery({
    queryKey: ["enamed-programs"],
    queryFn: fetchPrograms,
    staleTime: STALE_TIME,
  });
}

/**
 * Returns institutions that offer a given specialty, grouped by UF.
 */
export function useInstitutionsBySpecialty(specialtyName: string) {
  const { data: specialties } = useEnamedSpecialties();
  const { data: institutions } = useEnamedInstitutions();
  const { data: programs } = useEnamedPrograms();

  return useMemo(() => {
    if (!specialties || !institutions || !programs) return { grouped: null, flat: null };

    const specialty = specialties.find(
      (s) => s.name.toUpperCase() === specialtyName.toUpperCase()
    );
    if (!specialty) return { grouped: null, flat: null };

    const relevantPrograms = programs.filter((p) => p.specialty_id === specialty.id);
    const instMap = new Map(institutions.map((i) => [i.id, i]));

    const flat: InstitutionWithProgram[] = relevantPrograms
      .map((p) => {
        const inst = instMap.get(p.institution_id);
        if (!inst) return null;
        return { ...inst, vagas: p.vagas, cenario_pratica: p.cenario_pratica };
      })
      .filter(Boolean) as InstitutionWithProgram[];

    // Group by UF
    const grouped: Record<string, InstitutionWithProgram[]> = {};
    for (const inst of flat) {
      if (!grouped[inst.uf]) grouped[inst.uf] = [];
      grouped[inst.uf].push(inst);
    }

    // Sort UFs alphabetically, sort institutions within each UF
    const sortedGrouped: Record<string, InstitutionWithProgram[]> = {};
    for (const uf of Object.keys(grouped).sort()) {
      sortedGrouped[uf] = grouped[uf].sort((a, b) => a.name.localeCompare(b.name));
    }

    return { grouped: sortedGrouped, flat };
  }, [specialties, institutions, programs, specialtyName]);
}
