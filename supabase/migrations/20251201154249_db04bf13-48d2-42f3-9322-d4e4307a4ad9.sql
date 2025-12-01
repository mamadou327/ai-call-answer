create table if not exists public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null,
  business_id uuid not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  reason text not null,
  notes text,
  status text not null default 'approved',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint fk_staff_timeoff foreign key (staff_id) references public.staff(id) on delete cascade,
  constraint fk_business_timeoff foreign key (business_id) references public.businesses(id) on delete cascade
);

alter table public.staff_time_off enable row level security;

create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null,
  business_id uuid not null,
  user_id uuid,
  email text not null,
  status text not null default 'pending',
  invited_at timestamp with time zone default now(),
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint fk_staff_account foreign key (staff_id) references public.staff(id) on delete cascade,
  constraint fk_business_account foreign key (business_id) references public.businesses(id) on delete cascade,
  constraint fk_user_account foreign key (user_id) references auth.users(id) on delete cascade,
  constraint unique_staff unique(staff_id),
  constraint unique_email_business unique(email, business_id)
);

alter table public.staff_accounts enable row level security;