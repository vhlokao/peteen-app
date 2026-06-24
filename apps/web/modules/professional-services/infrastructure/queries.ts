/**
 * Módulo: professional-services
 * Camada: infrastructure — consultas de serviços do profissional
 */

import {
  findServicesByProfessionalId,
} from "@/modules/professional/infrastructure/repository"
import type { ProfessionalServiceRow } from "../domain/types"

export async function getProfessionalServices(
  professionalId: string
): Promise<ProfessionalServiceRow[]> {
  return findServicesByProfessionalId(professionalId)
}

export async function countProfessionalServices(
  professionalId: string
): Promise<number> {
  const services = await findServicesByProfessionalId(professionalId)
  return services.length
}
