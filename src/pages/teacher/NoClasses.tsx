import { EmptyState } from '../../components/bits'
import { useT } from '../../store/session'

/**
 * Every teacher screen shows this when nothing is assigned yet — reachable in
 * normal use, since Replace teacher can move a whole workload away. Without it
 * the screens read as broken ("0/0 entered", "0 students").
 */
export function NoClasses() {
  const t = useT()
  return <EmptyState icon="clipboard" title={t('noClassesTitle')} sub={t('noClassesSub')} />
}
