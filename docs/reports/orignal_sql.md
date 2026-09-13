-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_amh text,
  phone text,
  logo_url text,
  timezone text NOT NULL DEFAULT 'Africa/Addis_Ababa'::text,
  student_no_prefix text NOT NULL DEFAULT 'NO'::text,
  receipt_prefix text NOT NULL DEFAULT 'HB'::text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT schools_pkey PRIMARY KEY (id)
);
CREATE TABLE public.school_counters (
  school_id uuid NOT NULL,
  next_server_seq bigint NOT NULL DEFAULT 1,
  next_receipt_block bigint NOT NULL DEFAULT 1,
  CONSTRAINT school_counters_pkey PRIMARY KEY (school_id),
  CONSTRAINT school_counters_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.academic_years (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  label text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT academic_years_pkey PRIMARY KEY (id),
  CONSTRAINT academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.terms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  name text NOT NULL,
  seq smallint NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  closed_at timestamp with time zone,
  CONSTRAINT terms_pkey PRIMARY KEY (id),
  CONSTRAINT terms_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT terms_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  school_id uuid NOT NULL,
  first_name text NOT NULL,
  father_name text NOT NULL,
  sex text CHECK (sex = ANY (ARRAY['male'::text, 'female'::text])),
  position text NOT NULL DEFAULT 'teacher'::text CHECK ("position" = ANY (ARRAY['teacher'::text, 'senior_teacher'::text, 'head_of_department'::text, 'vice_principal'::text])),
  employment_type text CHECK (employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'contract'::text])),
  hire_date date,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'on_leave'::text, 'departed'::text])),
  departed_on date,
  server_seq bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT users_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'registrar'::text, 'cashier'::text])),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by uuid,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id)
);
CREATE TABLE public.guardians (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  alt_phone text,
  email text,
  national_id text,
  auth_user_id uuid,
  server_seq bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT guardians_pkey PRIMARY KEY (id),
  CONSTRAINT guardians_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT guardians_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.grade_levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  level smallint NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'archived'::text])),
  CONSTRAINT grade_levels_pkey PRIMARY KEY (id),
  CONSTRAINT grade_levels_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  grade_level_id uuid NOT NULL,
  name text NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT classes_grade_level_id_fkey FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  name_amh text,
  code text,
  deleted_at timestamp with time zone,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.class_years (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  homeroom_user_id uuid,
  capacity integer,
  CONSTRAINT class_years_pkey PRIMARY KEY (id),
  CONSTRAINT class_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT class_years_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT class_years_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id),
  CONSTRAINT class_years_homeroom_user_id_fkey FOREIGN KEY (homeroom_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.teaching_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  CONSTRAINT teaching_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT teaching_assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT teaching_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT teaching_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT teaching_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT teaching_assignments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id)
);
CREATE TABLE public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_no text NOT NULL,
  school_ref_no text,
  first_name text NOT NULL,
  father_name text NOT NULL,
  grandfather_name text,
  sex text CHECK (sex = ANY (ARRAY['male'::text, 'female'::text])),
  date_of_birth date,
  joined_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'graduated'::text, 'left'::text])),
  server_seq bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  class_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'withdrawn'::text, 'transferred'::text])),
  outcome text CHECK (outcome = ANY (ARRAY['promoted'::text, 'repeated'::text, 'graduated'::text, 'transferred_out'::text, 'left'::text])),
  enrolled_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,
  server_seq bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT enrollments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id),
  CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);
CREATE TABLE public.student_guardians (
  student_id uuid NOT NULL,
  guardian_id uuid NOT NULL,
  relationship text NOT NULL CHECK (relationship = ANY (ARRAY['mother'::text, 'father'::text, 'grandparent'::text, 'aunt_uncle'::text, 'sibling'::text, 'other'::text])),
  is_primary boolean NOT NULL DEFAULT false,
  can_collect boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_guardians_pkey PRIMARY KEY (student_id, guardian_id),
  CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT student_guardians_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES public.guardians(id)
);
CREATE TABLE public.attendance_registers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  business_date date NOT NULL,
  submitted_at timestamp with time zone,
  submitted_by uuid,
  server_seq bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_registers_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_registers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT attendance_registers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT attendance_registers_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id)
);
CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  business_date date NOT NULL,
  mark text NOT NULL CHECK (mark = ANY (ARRAY['P'::text, 'A'::text, 'L'::text])),
  marked_by uuid,
  client_recorded_at timestamp with time zone,
  server_seq bigint,
  deleted_at timestamp with time zone,
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT attendance_records_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT attendance_records_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id)
);
CREATE TABLE public.teacher_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  business_date date NOT NULL,
  checked_in_at timestamp with time zone,
  checked_out_at timestamp with time zone,
  source text NOT NULL DEFAULT 'server_stamped'::text CHECK (source = ANY (ARRAY['server_stamped'::text, 'device_unverified'::text])),
  status text NOT NULL DEFAULT 'verified'::text CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])),
  approved_by uuid,
  approved_at timestamp with time zone,
  client_recorded_at timestamp with time zone,
  server_seq bigint,
  CONSTRAINT teacher_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_attendance_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT teacher_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT teacher_attendance_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.assessment_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  key text NOT NULL CHECK (key = ANY (ARRAY['homework'::text, 'classwork'::text, 'exercise_book'::text, 'worksheets'::text, 'assignments'::text, 'tests'::text, 'exams'::text, 'final_exam'::text])),
  name text NOT NULL,
  name_amh text,
  is_enabled boolean NOT NULL DEFAULT true,
  seq smallint NOT NULL DEFAULT 0,
  CONSTRAINT assessment_types_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_types_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.subject_weights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  term_id uuid NOT NULL,
  grade_level_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  assessment_type_id uuid NOT NULL,
  weight smallint NOT NULL CHECK (weight >= 0 AND weight <= 100),
  locked_at timestamp with time zone,
  CONSTRAINT subject_weights_pkey PRIMARY KEY (id),
  CONSTRAINT subject_weights_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT subject_weights_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id),
  CONSTRAINT subject_weights_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id),
  CONSTRAINT subject_weights_grade_level_id_fkey FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id),
  CONSTRAINT subject_weights_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT subject_weights_assessment_type_id_fkey FOREIGN KEY (assessment_type_id) REFERENCES public.assessment_types(id)
);
CREATE TABLE public.assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  assessment_type_id uuid NOT NULL,
  term_id uuid NOT NULL,
  title text NOT NULL,
  max_score numeric NOT NULL CHECK (max_score > 0::numeric),
  business_date date NOT NULL,
  created_by uuid NOT NULL,
  client_recorded_at timestamp with time zone,
  server_seq bigint,
  deleted_at timestamp with time zone,
  CONSTRAINT assessments_pkey PRIMARY KEY (id),
  CONSTRAINT assessments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT assessments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT assessments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT assessments_assessment_type_id_fkey FOREIGN KEY (assessment_type_id) REFERENCES public.assessment_types(id),
  CONSTRAINT assessments_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id),
  CONSTRAINT assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.assessment_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  raw_score numeric CHECK (raw_score IS NULL OR raw_score >= 0::numeric),
  entered_by uuid NOT NULL,
  client_recorded_at timestamp with time zone,
  server_seq bigint,
  deleted_at timestamp with time zone,
  CONSTRAINT assessment_scores_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_scores_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT assessment_scores_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT assessment_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT assessment_scores_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.users(id)
);
CREATE TABLE public.assessment_score_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  old_score numeric,
  new_score numeric,
  changed_by uuid,
  reason text,
  source text NOT NULL DEFAULT 'edit'::text CHECK (source = ANY (ARRAY['edit'::text, 'conflict_lost'::text])),
  server_seq bigint,
  at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assessment_score_history_pkey PRIMARY KEY (id),
  CONSTRAINT assessment_score_history_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT assessment_score_history_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id),
  CONSTRAINT assessment_score_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT assessment_score_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id)
);
CREATE TABLE public.report_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  term_id uuid NOT NULL,
  comment text,
  updated_by uuid,
  server_seq bigint,
  CONSTRAINT report_comments_pkey PRIMARY KEY (id),
  CONSTRAINT report_comments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT report_comments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT report_comments_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id),
  CONSTRAINT report_comments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);
CREATE TABLE public.fee_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  grade_level_id uuid NOT NULL,
  name text NOT NULL,
  amount_santim bigint NOT NULL CHECK (amount_santim >= 0),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['term'::text, 'annual'::text])),
  term_id uuid,
  deleted_at timestamp with time zone,
  CONSTRAINT fee_items_pkey PRIMARY KEY (id),
  CONSTRAINT fee_items_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT fee_items_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id),
  CONSTRAINT fee_items_grade_level_id_fkey FOREIGN KEY (grade_level_id) REFERENCES public.grade_levels(id),
  CONSTRAINT fee_items_term_id_fkey FOREIGN KEY (term_id) REFERENCES public.terms(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  receipt_no text NOT NULL,
  total_santim bigint NOT NULL CHECK (total_santim > 0),
  method text NOT NULL CHECK (method = ANY (ARRAY['cash'::text, 'bank'::text, 'telebirr'::text])),
  received_by uuid NOT NULL,
  business_date date NOT NULL,
  client_recorded_at timestamp with time zone,
  server_seq bigint,
  op_id uuid NOT NULL UNIQUE,
  voided_at timestamp with time zone,
  voided_by uuid,
  void_reason text,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id),
  CONSTRAINT payments_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES public.users(id)
);
CREATE TABLE public.payment_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  fee_item_id uuid NOT NULL,
  label text NOT NULL,
  amount_santim bigint NOT NULL CHECK (amount_santim > 0),
  CONSTRAINT payment_lines_pkey PRIMARY KEY (id),
  CONSTRAINT payment_lines_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT payment_lines_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id),
  CONSTRAINT payment_lines_fee_item_id_fkey FOREIGN KEY (fee_item_id) REFERENCES public.fee_items(id)
);
CREATE TABLE public.receipt_leases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  device_id text NOT NULL,
  block_start bigint NOT NULL,
  block_end bigint NOT NULL,
  next_number bigint NOT NULL,
  leased_at timestamp with time zone NOT NULL DEFAULT now(),
  exhausted_at timestamp with time zone,
  CONSTRAINT receipt_leases_pkey PRIMARY KEY (id),
  CONSTRAINT receipt_leases_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.change_log (
  school_id uuid NOT NULL,
  seq bigint NOT NULL,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  op text NOT NULL CHECK (op = ANY (ARRAY['upsert'::text, 'delete'::text])),
  payload jsonb,
  actor_user_id uuid,
  server_time timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT change_log_pkey PRIMARY KEY (school_id, seq),
  CONSTRAINT change_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT change_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.sync_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  device_id text NOT NULL,
  user_id uuid NOT NULL,
  cursor_seq bigint NOT NULL DEFAULT 0,
  scope_version integer NOT NULL DEFAULT 1,
  platform text,
  app_version text,
  last_seen_at timestamp with time zone,
  CONSTRAINT sync_devices_pkey PRIMARY KEY (id),
  CONSTRAINT sync_devices_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT sync_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.processed_ops (
  op_id uuid NOT NULL,
  school_id uuid NOT NULL,
  device_id text NOT NULL,
  table_name text NOT NULL,
  row_id uuid,
  result text NOT NULL CHECK (result = ANY (ARRAY['applied'::text, 'duplicate'::text, 'rejected'::text, 'superseded'::text])),
  server_seq bigint,
  processed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT processed_ops_pkey PRIMARY KEY (op_id),
  CONSTRAINT processed_ops_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id)
);
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  actor_user_id uuid,
  subject_table text NOT NULL,
  subject_id uuid,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  server_seq bigint,
  at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id)
);
