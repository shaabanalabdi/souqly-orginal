import { AccountType, Role, StaffRole } from '@prisma/client';

export interface AuthorizationActorLike {
    role?: Role | null;
    staffRole?: StaffRole | null;
    accountType?: AccountType | null;
}

export interface NormalizedAccessClaims {
    role: Role;
    staffRole: StaffRole;
    accountType: AccountType;
}

export function staffRoleFromLegacyRole(role: Role | null | undefined): StaffRole {
    if (role === Role.ADMIN) return StaffRole.ADMIN;
    if (role === Role.MODERATOR) return StaffRole.MODERATOR;
    return StaffRole.NONE;
}

export function legacyRoleFromStaffRole(staffRole: StaffRole | null | undefined): Role {
    if (staffRole === StaffRole.ADMIN) return Role.ADMIN;
    if (staffRole === StaffRole.MODERATOR) return Role.MODERATOR;
    return Role.USER;
}

export function normalizeAccessClaims(payload: AuthorizationActorLike): NormalizedAccessClaims {
    const staffRole = payload.staffRole ?? staffRoleFromLegacyRole(payload.role);
    const role = legacyRoleFromStaffRole(staffRole);
    const accountType = payload.accountType ?? AccountType.INDIVIDUAL;

    return {
        role,
        staffRole,
        accountType,
    };
}

export function resolveStaffRole(actor: AuthorizationActorLike): StaffRole {
    return actor.staffRole ?? StaffRole.NONE;
}

export function resolveAccountType(actor: AuthorizationActorLike): AccountType {
    return normalizeAccessClaims(actor).accountType;
}

export function isAdmin(actor: AuthorizationActorLike): boolean {
    return resolveStaffRole(actor) === StaffRole.ADMIN;
}

export function isModeratorOrAdmin(actor: AuthorizationActorLike): boolean {
    const staffRole = resolveStaffRole(actor);
    return staffRole === StaffRole.MODERATOR || staffRole === StaffRole.ADMIN;
}

export function isIndividualNonStaff(actor: AuthorizationActorLike): boolean {
    return resolveAccountType(actor) === AccountType.INDIVIDUAL && resolveStaffRole(actor) === StaffRole.NONE;
}
