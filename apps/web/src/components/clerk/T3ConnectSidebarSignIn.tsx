import { UserButton, useAuth } from "@clerk/react";
import { T, useMessages } from "gt-react";
import { CloudIcon, CloudOffIcon, LogInIcon, RotateCwIcon } from "lucide-react";

import {
  canOptInToDesktopConnect,
  hasCloudPublicConfig,
  isDesktopConnectOptedIn,
  setDesktopConnectOptIn,
} from "../../cloud/publicConfig";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";
import { retryClerkLoad, useClerkLoadFailed } from "./clerkLoadFailure";
import { T3_CONNECT_ACCOUNT_PAGES } from "./T3ConnectAccountPages";
import { useT3ConnectAuthPrompt } from "./useT3ConnectAuthPrompt";

export function T3ConnectSidebarSignIn() {
  if (canOptInToDesktopConnect()) return <DesktopConnectOptIn />;
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredT3ConnectSidebarSignIn />;
}

export function T3ConnectSidebarAvatar() {
  if (!hasCloudPublicConfig()) return null;

  return <ConfiguredT3ConnectSidebarAvatar />;
}

function ConfiguredT3ConnectSidebarAvatar() {
  const { isLoaded, isSignedIn } = useAuth();
  const m = useMessages();

  if (!isLoaded || !isSignedIn) return null;

  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: "size-7",
          // Clerk's unlayered trigger reset (padding, radius, background) beats layered utilities.
          userButtonTrigger: "mb-1! rounded-lg! p-1! hover:bg-sidebar-row-hover!",
        },
      }}
    >
      {T3_CONNECT_ACCOUNT_PAGES.map((page) => (
        <UserButton.UserProfilePage
          key={page.url}
          label={m(page.label)}
          labelIcon={page.icon}
          url={page.url}
        >
          {page.content}
        </UserButton.UserProfilePage>
      ))}
    </UserButton>
  );
}

function ConfiguredT3ConnectSidebarSignIn() {
  const { isLoaded, isSignedIn } = useAuth();
  const loadFailed = useClerkLoadFailed();
  const { openAuthPrompt } = useT3ConnectAuthPrompt();

  if (loadFailed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={retryClerkLoad}>
            <RotateCwIcon />
            <span>
              <T>Retry T3 Connect</T>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  if (!isLoaded || isSignedIn) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={openAuthPrompt}>
          <LogInIcon />
          <span>
            <T>Sign in to T3 Connect</T>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {isDesktopConnectOptedIn() ? (
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => setDesktopConnectOptIn(false)}>
            <CloudOffIcon />
            <span>
              <T>Turn off T3 Connect on this device</T>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : null}
    </SidebarMenu>
  );
}

/** Privacy build: nothing contacts Clerk until this is clicked. */
function DesktopConnectOptIn() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton onClick={() => setDesktopConnectOptIn(true)}>
          <CloudIcon />
          <span>
            <T>Set up T3 Connect</T>
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
