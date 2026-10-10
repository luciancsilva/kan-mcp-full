import type { Tool } from './tool';
import {
  workspaceListTool,
  workspaceCreateTool,
  workspaceGetByIdTool,
  workspaceGetBySlugTool,
  workspaceUpdateTool,
  workspaceDeleteTool,
  workspaceSearchTool,
  workspaceCheckSlugAvailabilityTool,
  workspaceFindByNameTool,
} from './workspace';
import {
  boardListTool,
  boardCreateTool,
  boardGetByIdTool,
  boardGetBySlugTool,
  boardUpdateTool,
  boardDeleteTool,
  boardCheckSlugAvailabilityTool,
  boardFindByNameTool,
} from './board';
import {
  listCreateTool,
  listUpdateTool,
  listDeleteTool,
} from './list';
import {
  cardCreateTool,
  cardGetByIdTool,
  cardUpdateTool,
  cardDeleteTool,
  cardAddLabelTool,
  cardRemoveLabelTool,
  cardAddMemberTool,
  cardRemoveMemberTool,
  cardListActivitiesTool,
  cardDuplicateTool,
} from './card';
import {
  labelCreateTool,
  labelGetByIdTool,
  labelUpdateTool,
  labelDeleteTool,
} from './label';
import {
  checklistCreateTool,
  checklistUpdateTool,
  checklistDeleteTool,
  checklistAddItemTool,
  checklistUpdateItemTool,
  checklistDeleteItemTool,
} from './checklist';
import {
  commentAddTool,
  commentUpdateTool,
  commentDeleteTool,
} from './comment';
import {
  attachmentAddTool,
  attachmentListTool,
  attachmentRemoveTool,
  attachmentDownloadTool,
} from './attachment';
import {
  memberInviteTool,
  memberRemoveTool,
  memberUpdateRoleTool,
  workspaceGetInviteLinkTool,
  workspaceCreateInviteLinkTool,
  workspaceDeactivateInviteLinksTool,
} from './member';
import { serverHealthTool } from './server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tools: any[] = [
  workspaceListTool,
  workspaceCreateTool,
  workspaceGetByIdTool,
  workspaceGetBySlugTool,
  workspaceUpdateTool,
  workspaceDeleteTool,
  workspaceSearchTool,
  workspaceCheckSlugAvailabilityTool,
  workspaceFindByNameTool,
  boardListTool,
  boardCreateTool,
  boardGetByIdTool,
  boardGetBySlugTool,
  boardUpdateTool,
  boardDeleteTool,
  boardCheckSlugAvailabilityTool,
  boardFindByNameTool,
  listCreateTool,
  listUpdateTool,
  listDeleteTool,
  cardCreateTool,
  cardGetByIdTool,
  cardUpdateTool,
  cardDeleteTool,
  cardAddLabelTool,
  cardRemoveLabelTool,
  cardAddMemberTool,
  cardRemoveMemberTool,
  cardListActivitiesTool,
  cardDuplicateTool,
  labelCreateTool,
  labelGetByIdTool,
  labelUpdateTool,
  labelDeleteTool,
  checklistCreateTool,
  checklistUpdateTool,
  checklistDeleteTool,
  checklistAddItemTool,
  checklistUpdateItemTool,
  checklistDeleteItemTool,
  commentAddTool,
  commentUpdateTool,
  commentDeleteTool,
  attachmentAddTool,
  attachmentListTool,
  attachmentRemoveTool,
  attachmentDownloadTool,
  memberInviteTool,
  memberRemoveTool,
  memberUpdateRoleTool,
  workspaceGetInviteLinkTool,
  workspaceCreateInviteLinkTool,
  workspaceDeactivateInviteLinksTool,
  serverHealthTool,
];

export type { Tool } from './tool';
